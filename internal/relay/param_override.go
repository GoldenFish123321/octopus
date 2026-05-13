package relay

import (
	"encoding/json"
	"fmt"
	"reflect"
	"strconv"
	"strings"

	dbmodel "github.com/bestruirui/octopus/internal/model"
	"github.com/bestruirui/octopus/internal/transformer/model"
	"github.com/bestruirui/octopus/internal/utils/log"
)

type paramOverrideConfig struct {
	Operations []paramOperation `json:"operations"`
}

type paramOperation struct {
	Path       string          `json:"path"`
	Mode       string          `json:"mode"` // "set"
	Value      json.RawMessage `json:"value"`
	Conditions []paramCondition `json:"conditions,omitempty"`
	Logic      string          `json:"logic,omitempty"` // "AND" / "OR", default OR
}

type paramCondition struct {
	Path   string `json:"path"`
	Mode   string `json:"mode"` // "prefix", "contains"
	Value  string `json:"value"`
	Invert bool   `json:"invert,omitempty"`
}

func ApplyParamOverride(channel *dbmodel.Channel, req *model.InternalLLMRequest) error {
	if channel.ParamOverride == nil || *channel.ParamOverride == "" {
		return nil
	}

	raw := []byte(*channel.ParamOverride)

	var cfg paramOverrideConfig
	if err := json.Unmarshal(raw, &cfg); err == nil && len(cfg.Operations) > 0 {
		return applyOperations(cfg.Operations, req)
	}

	return applySimpleOverride(raw, req)
}

func applySimpleOverride(raw []byte, req *model.InternalLLMRequest) error {
	var simple map[string]any
	if err := json.Unmarshal(raw, &simple); err != nil {
		return fmt.Errorf("invalid param_override JSON: %w", err)
	}
	for k, v := range simple {
		if err := setFieldByJSONTag(req, k, v); err != nil {
			log.Warnf("simple override skip field %q: %v", k, err)
		}
	}
	return nil
}

func applyOperations(ops []paramOperation, req *model.InternalLLMRequest) error {
	for _, op := range ops {
		if op.Mode != "set" {
			log.Warnf("unsupported operation mode %q, skip", op.Mode)
			continue
		}

		if !evaluateConditions(op.Conditions, op.Logic, req) {
			continue
		}

		var val any
		if err := json.Unmarshal(op.Value, &val); err != nil {
			val = string(op.Value)
		}
		if err := setFieldByJSONTag(req, op.Path, val); err != nil {
			log.Warnf("operation set field %q failed: %v", op.Path, err)
		}
	}
	return nil
}

func evaluateConditions(conditions []paramCondition, logic string, req *model.InternalLLMRequest) bool {
	if len(conditions) == 0 {
		return true
	}

	logic = strings.ToUpper(logic)
	if logic != "AND" {
		logic = "OR"
	}

	for _, cond := range conditions {
		actual := getFieldValue(req, cond.Path)
		matched := matchCondition(actual, cond.Value, cond.Mode)
		if cond.Invert {
			matched = !matched
		}

		if logic == "OR" && matched {
			return true
		}
		if logic == "AND" && !matched {
			return false
		}
	}

	return logic == "AND"
}

func matchCondition(actual, expected, mode string) bool {
	switch mode {
	case "prefix":
		return strings.HasPrefix(actual, expected)
	case "contains":
		return strings.Contains(actual, expected)
	default:
		return actual == expected
	}
}

func getFieldValue(req *model.InternalLLMRequest, jsonTag string) string {
	v, err := getFieldByJSONTag(req, jsonTag)
	if err != nil {
		return ""
	}
	return v
}

func jsonTagKey(sf reflect.StructField) string {
	tag := sf.Tag.Get("json")
	if tag == "" {
		return ""
	}
	if idx := strings.Index(tag, ","); idx != -1 {
		return tag[:idx]
	}
	return tag
}

func setFieldByJSONTag(ptr any, jsonTag string, value any) error {
	rv := reflect.ValueOf(ptr)
	if rv.Kind() != reflect.Ptr || rv.Elem().Kind() != reflect.Struct {
		return fmt.Errorf("expected pointer to struct")
	}
	rv = rv.Elem()
	rt := rv.Type()

	for i := 0; i < rt.NumField(); i++ {
		sf := rt.Field(i)
		if jsonTagKey(sf) != jsonTag {
			continue
		}
		fv := rv.Field(i)
		if !fv.CanSet() {
			return fmt.Errorf("field %s cannot be set", sf.Name)
		}
		return assignValue(fv, value)
	}
	return fmt.Errorf("field with json tag %q not found", jsonTag)
}

func getFieldByJSONTag(ptr any, jsonTag string) (string, error) {
	rv := reflect.ValueOf(ptr)
	if rv.Kind() != reflect.Ptr || rv.Elem().Kind() != reflect.Struct {
		return "", fmt.Errorf("expected pointer to struct")
	}
	rv = rv.Elem()
	rt := rv.Type()

	for i := 0; i < rt.NumField(); i++ {
		sf := rt.Field(i)
		if jsonTagKey(sf) != jsonTag {
			continue
		}
		fv := rv.Field(i)
		if fv.Kind() == reflect.Ptr {
			if fv.IsNil() {
				return "", nil
			}
			fv = fv.Elem()
		}
		return fmt.Sprintf("%v", fv.Interface()), nil
	}
	return "", fmt.Errorf("field with json tag %q not found", jsonTag)
}

func assignValue(fv reflect.Value, val any) error {
	if val == nil {
		return nil
	}

	// Unwrap pointer
	if fv.Kind() == reflect.Ptr {
		if fv.IsNil() {
			fv.Set(reflect.New(fv.Type().Elem()))
		}
		return assignValue(fv.Elem(), val)
	}

	// json.RawMessage ([]byte)
	if fv.Type() == reflect.TypeOf(json.RawMessage{}) {
		b, err := json.Marshal(val)
		if err != nil {
			return err
		}
		fv.Set(reflect.ValueOf(json.RawMessage(b)))
		return nil
	}

	switch fv.Kind() {
	case reflect.String:
		fv.SetString(fmt.Sprintf("%v", val))
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		n, err := toInt64(val)
		if err != nil {
			return err
		}
		fv.SetInt(n)
	case reflect.Float32, reflect.Float64:
		f, err := toFloat64(val)
		if err != nil {
			return err
		}
		fv.SetFloat(f)
	case reflect.Bool:
		b, err := toBool(val)
		if err != nil {
			return err
		}
		fv.SetBool(b)
	default:
		return fmt.Errorf("unsupported field kind %v", fv.Kind())
	}
	return nil
}

func toInt64(val any) (int64, error) {
	switch v := val.(type) {
	case float64:
		return int64(v), nil
	case json.Number:
		return v.Int64()
	case string:
		return strconv.ParseInt(v, 10, 64)
	case bool:
		if v {
			return 1, nil
		}
		return 0, nil
	default:
		return 0, fmt.Errorf("cannot convert %T to int64", val)
	}
}

func toFloat64(val any) (float64, error) {
	switch v := val.(type) {
	case float64:
		return v, nil
	case json.Number:
		return v.Float64()
	case string:
		return strconv.ParseFloat(v, 64)
	default:
		return 0, fmt.Errorf("cannot convert %T to float64", val)
	}
}

func toBool(val any) (bool, error) {
	switch v := val.(type) {
	case bool:
		return v, nil
	case string:
		return strconv.ParseBool(v)
	case float64:
		return v != 0, nil
	default:
		return false, fmt.Errorf("cannot convert %T to bool", val)
	}
}

// ApplyParamOverrideMap applies param override to a raw JSON payload (map[string]any).
// Used by ImagesHandler where requests are not parsed into InternalLLMRequest.
func ApplyParamOverrideMap(channel *dbmodel.Channel, payload map[string]any) error {
	if channel.ParamOverride == nil || *channel.ParamOverride == "" {
		return nil
	}

	raw := []byte(*channel.ParamOverride)

	var cfg paramOverrideConfig
	if err := json.Unmarshal(raw, &cfg); err == nil && len(cfg.Operations) > 0 {
		return applyMapOperations(cfg.Operations, payload)
	}

	return applyMapSimpleOverride(raw, payload)
}

func applyMapSimpleOverride(raw []byte, payload map[string]any) error {
	var simple map[string]any
	if err := json.Unmarshal(raw, &simple); err != nil {
		return fmt.Errorf("invalid param_override JSON: %w", err)
	}
	for k, v := range simple {
		payload[k] = v
	}
	return nil
}

func applyMapOperations(ops []paramOperation, payload map[string]any) error {
	for _, op := range ops {
		if op.Mode != "set" {
			log.Warnf("unsupported operation mode %q, skip", op.Mode)
			continue
		}

		if !evaluateMapConditions(op.Conditions, op.Logic, payload) {
			continue
		}

		var val any
		if err := json.Unmarshal(op.Value, &val); err != nil {
			val = string(op.Value)
		}
		payload[op.Path] = val
	}
	return nil
}

func evaluateMapConditions(conditions []paramCondition, logic string, payload map[string]any) bool {
	if len(conditions) == 0 {
		return true
	}

	logic = strings.ToUpper(logic)
	if logic != "AND" {
		logic = "OR"
	}

	for _, cond := range conditions {
		actual := getMapFieldValue(payload, cond.Path)
		matched := matchCondition(actual, cond.Value, cond.Mode)
		if cond.Invert {
			matched = !matched
		}

		if logic == "OR" && matched {
			return true
		}
		if logic == "AND" && !matched {
			return false
		}
	}

	return logic == "AND"
}

func getMapFieldValue(payload map[string]any, key string) string {
	val, ok := payload[key]
	if !ok {
		return ""
	}
	switch v := val.(type) {
	case float64:
		return strconv.FormatFloat(v, 'f', -1, 64)
	case json.Number:
		return v.String()
	default:
		return fmt.Sprintf("%v", v)
	}
}
