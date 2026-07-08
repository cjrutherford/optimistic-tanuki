FROM pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime

ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y \
    curl \
    git \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    audiocraft \
    demucs \
    torchaudio

RUN mkdir -p /models

COPY scripts/ /scripts/
RUN chmod +x /scripts/*.sh

EXPOSE 3100

CMD ["/scripts/serve-models.sh"]
