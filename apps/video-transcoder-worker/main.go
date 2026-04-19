package main

import (
	"bufio"
	"context"
	"encoding/json"
	"log"
	"net"
	"os"
	"strconv"

	"github.com/cjrutherford/optimistic-tanuki/video-transcoder-worker/internal/protocol"
	"github.com/cjrutherford/optimistic-tanuki/video-transcoder-worker/internal/transcode"
)

func main() {
	port := envInt("PORT", 3022)
	host := envString("HOST", "0.0.0.0")
	outputRoot := envString("VIDEO_TRANSCODER_OUTPUT_ROOT", "/tmp/video-processing")

	worker := transcode.New(outputRoot)
	listener, err := net.Listen("tcp", net.JoinHostPort(host, strconv.Itoa(port)))
	if err != nil {
		log.Fatalf("listen: %v", err)
	}
	defer listener.Close()

	log.Printf("video transcoder worker listening on %s:%d", host, port)

	for {
		conn, err := listener.Accept()
		if err != nil {
			log.Printf("accept: %v", err)
			continue
		}

		go handleConnection(conn, worker)
	}
}

func handleConnection(conn net.Conn, worker *transcode.Worker) {
	defer conn.Close()

	reader := bufio.NewReader(conn)
	line, err := reader.ReadBytes('\n')
	if err != nil {
		writeResponse(conn, protocol.Response{OK: false, Error: err.Error()})
		return
	}

	var request protocol.Request
	if err := json.Unmarshal(line, &request); err != nil {
		writeResponse(conn, protocol.Response{OK: false, Error: err.Error()})
		return
	}

	if request.Command != "transcode-video" {
		writeResponse(conn, protocol.Response{OK: false, Error: "unsupported command"})
		return
	}

	result, err := worker.Process(context.Background(), request.Request)
	if err != nil {
		writeResponse(conn, protocol.Response{OK: false, Error: err.Error()})
		return
	}

	writeResponse(conn, protocol.Response{OK: true, Result: result})
}

func writeResponse(conn net.Conn, response protocol.Response) {
	encoded, err := json.Marshal(response)
	if err != nil {
		log.Printf("marshal response: %v", err)
		return
	}
	_, _ = conn.Write(append(encoded, '\n'))
}

func envString(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func envInt(key string, fallback int) int {
	if value := os.Getenv(key); value != "" {
		parsed, err := strconv.Atoi(value)
		if err == nil {
			return parsed
		}
	}
	return fallback
}
