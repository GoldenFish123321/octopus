package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/bestruirui/octopus/internal/model"
	"github.com/bestruirui/octopus/internal/op"
	"github.com/bestruirui/octopus/internal/server/middleware"
	"github.com/bestruirui/octopus/internal/server/resp"
	"github.com/bestruirui/octopus/internal/server/router"
	"github.com/gin-gonic/gin"
)

func init() {
	router.NewGroupRouter("/api/v1/log").
		Use(middleware.Auth()).
		AddRoute(
			router.NewRoute("/list", http.MethodGet).
				Handle(listLog),
		).
		AddRoute(
			router.NewRoute("/detail", http.MethodGet).
				Handle(getLogDetail),
		).
		AddRoute(
			router.NewRoute("/clear", http.MethodDelete).
				Handle(clearLog),
		).
		AddRoute(
			router.NewRoute("/stream-token", http.MethodGet).
				Handle(getStreamToken),
		)

	router.NewGroupRouter("/api/v1/log").
		AddRoute(
			router.NewRoute("/stream", http.MethodGet).
				Handle(streamLog),
		)
}

func listLog(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	filter, err := parseRelayLogFilter(c)
	if err != nil {
		resp.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	logs, err := op.RelayLogList(c.Request.Context(), page, pageSize, filter)
	if err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	op.RelayLogStripContent(logs)
	resp.Success(c, logs)
}

func getLogDetail(c *gin.Context) {
	id, err := strconv.ParseInt(c.Query("id"), 10, 64)
	if err != nil {
		resp.Error(c, http.StatusBadRequest, "invalid id")
		return
	}

	log, err := op.RelayLogDetail(c.Request.Context(), id)
	if err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	resp.Success(c, log)
}

func clearLog(c *gin.Context) {
	if err := op.RelayLogClear(c.Request.Context()); err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, nil)
}

func getStreamToken(c *gin.Context) {
	token, err := op.RelayLogStreamTokenCreate()
	if err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, gin.H{"token": token})
}

func parseRelayLogFilter(c *gin.Context) (*model.RelayLogListFilter, error) {
	group := strings.TrimSpace(c.Query("group"))
	modelName := strings.TrimSpace(c.Query("model"))
	channel := strings.TrimSpace(c.Query("channel"))
	retriedStr := strings.TrimSpace(c.Query("retried"))
	apiKey := strings.TrimSpace(c.Query("apikey"))
	search := strings.TrimSpace(c.Query("search"))
	startTimeStr := strings.TrimSpace(c.Query("start_time"))
	endTimeStr := strings.TrimSpace(c.Query("end_time"))

	if group == "" && modelName == "" && channel == "" && retriedStr == "" &&
		apiKey == "" && search == "" && startTimeStr == "" && endTimeStr == "" {
		return nil, nil
	}

	filter := &model.RelayLogListFilter{}
	if group != "" {
		filter.Group = &group
	}
	if modelName != "" {
		filter.Model = &modelName
	}
	if channel != "" {
		filter.Channel = &channel
	}
	if retriedStr != "" {
		retried, err := strconv.ParseBool(retriedStr)
		if err != nil {
			return nil, fmt.Errorf("invalid retried value")
		}
		filter.Retried = &retried
	}
	if apiKey != "" {
		filter.APIKey = &apiKey
	}
	if search != "" {
		filter.Search = &search
	}
	if startTimeStr != "" {
		st, err := strconv.Atoi(startTimeStr)
		if err != nil {
			return nil, fmt.Errorf("invalid start_time value")
		}
		filter.StartTime = &st
	}
	if endTimeStr != "" {
		et, err := strconv.Atoi(endTimeStr)
		if err != nil {
			return nil, fmt.Errorf("invalid end_time value")
		}
		filter.EndTime = &et
	}

	return filter, nil
}

func streamLog(c *gin.Context) {
	token := c.Query("token")
	if token == "" || !op.RelayLogStreamTokenVerify(token) {
		resp.Error(c, http.StatusUnauthorized, "invalid stream token")
		return
	}

	op.RelayLogStreamTokenRevoke(token)

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	logChan := op.RelayLogSubscribe()
	defer op.RelayLogUnsubscribe(logChan)

	ctx := c.Request.Context()

	for {
		select {
		case <-ctx.Done():
			return
		case log, ok := <-logChan:
			if !ok {
				return
			}
			data, err := json.Marshal(log)
			if err != nil {
				continue
			}
			c.Writer.Write([]byte(fmt.Sprintf("data: %s\n\n", data)))
			c.Writer.Flush()
		}
	}
}
