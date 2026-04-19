FROM golang:1.24-alpine AS builder
WORKDIR /src
COPY apps/video-transcoder-worker/go.mod ./go.mod
COPY apps/video-transcoder-worker/main.go ./main.go
COPY apps/video-transcoder-worker/internal ./internal
RUN GOCACHE=/tmp/go-build go build -o /out/video-transcoder-worker .

FROM alpine:3.22
RUN apk add --no-cache ffmpeg dumb-init
WORKDIR /app
COPY --from=builder /out/video-transcoder-worker /usr/local/bin/video-transcoder-worker
ENV PORT=3022
ENV HOST=0.0.0.0
ENV VIDEO_TRANSCODER_OUTPUT_ROOT=/tmp/video-processing
EXPOSE 3022
CMD ["dumb-init", "/usr/local/bin/video-transcoder-worker"]
