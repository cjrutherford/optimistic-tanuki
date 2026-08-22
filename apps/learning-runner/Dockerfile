FROM node:24-alpine

RUN apk add --no-cache dumb-init nsjail go g++ rust cargo curl

# Catch2, for the C++ testing exercises.
#
# Compiling the amalgamated distribution costs about nine seconds, and a single
# run gets ten in total, so it is built once here. With the object ready,
# linking a challenge against it takes well under a second.
#
# Pinned and checksummed: an unpinned download would make the image
# irreproducible, and the C++ verifier depends on this exact behaviour.
ARG CATCH2_VERSION=v3.7.1
ARG CATCH2_HPP_SHA256=91d47e2ddfb2949df22ff582d6c292554184da743e11d3811dcdd06b5b0a159b
ARG CATCH2_CPP_SHA256=450fc5f213a87668f0f48c91a2afa4f4226186fef453d36e6fa3bc184ccdb9ba
ENV CATCH2_DIR=/opt/catch2

RUN set -eux; \
    mkdir -p "$CATCH2_DIR"; \
    base="https://github.com/catchorg/Catch2/releases/download/${CATCH2_VERSION}"; \
    curl -fsSL -o "$CATCH2_DIR/catch_amalgamated.hpp" "$base/catch_amalgamated.hpp"; \
    curl -fsSL -o "$CATCH2_DIR/catch_amalgamated.cpp" "$base/catch_amalgamated.cpp"; \
    echo "$CATCH2_HPP_SHA256  $CATCH2_DIR/catch_amalgamated.hpp" | sha256sum -c -; \
    echo "$CATCH2_CPP_SHA256  $CATCH2_DIR/catch_amalgamated.cpp" | sha256sum -c -; \
    g++ -std=c++17 -O1 -I"$CATCH2_DIR" -c "$CATCH2_DIR/catch_amalgamated.cpp" \
        -o "$CATCH2_DIR/catch_amalgamated.o"; \
    rm "$CATCH2_DIR/catch_amalgamated.cpp"; \
    chmod -R a+rX "$CATCH2_DIR"

# Where submissions are compiled and run. It exists in the image so a plain
# `docker run` works; production overlays an exec-capable tmpfs on top, because
# the root filesystem there is read-only and /tmp is noexec.
RUN mkdir -p /scratch && chown node:node /scratch
ENV LEARNING_SCRATCH_DIR=/scratch

WORKDIR /app
COPY apps/learning-runner/server.mjs ./server.mjs
COPY apps/learning-runner/lib ./lib

USER node
ENV PORT=3025
EXPOSE 3025
CMD ["dumb-init", "node", "server.mjs"]
