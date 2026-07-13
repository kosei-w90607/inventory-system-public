FROM rust:1.94-bookworm

# システム依存パッケージ（SQLite + Tauri 2.0 Linux依存）
RUN apt-get update && apt-get install -y \
    sqlite3 \
    libsqlite3-dev \
    pkg-config \
    curl \
    build-essential \
    libwebkit2gtk-4.1-dev \
    libssl-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    libxdo-dev \
    file \
    && rm -rf /var/lib/apt/lists/*

# Node.js 20 LTS
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Rust コンポーネント
RUN rustup component add clippy rustfmt

# 作業ディレクトリ
WORKDIR /workspace

# Rustのビルドキャッシュを永続化するためのボリュームマウントポイント
ENV CARGO_HOME=/cargo-cache
