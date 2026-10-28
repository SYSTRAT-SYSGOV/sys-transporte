FROM rust:bookworm AS builder
WORKDIR /app
COPY backend/Cargo.toml backend/Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -rf src
COPY backend/ ./
# As migrations são embutidas via include_str!("../../db/migrations/...") a
# partir de /app/src, o que resolve para /db.
COPY db /db
RUN touch src/main.rs && cargo build --release

FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
RUN useradd --system --create-home --uid 10001 app
COPY --from=builder /app/target/release/transport-api /usr/local/bin/transport-api
USER app
EXPOSE 8080
CMD ["transport-api"]
