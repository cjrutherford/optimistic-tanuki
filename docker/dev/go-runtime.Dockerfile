FROM alpine:3.22

RUN apk add --no-cache dumb-init ffmpeg

WORKDIR /usr/src/app

ENV PORT=3022
ENV HOST=0.0.0.0
ENV VIDEO_TRANSCODER_OUTPUT_ROOT=/tmp/video-processing

EXPOSE 3022

CMD ["dumb-init", "/usr/src/app/video-transcoder-worker"]
