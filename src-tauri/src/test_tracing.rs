use std::io::Write;
use std::sync::{Arc, Mutex};
use tracing_subscriber::fmt::MakeWriter;

#[derive(Clone, Default)]
struct CapturedWriter {
    bytes: Arc<Mutex<Vec<u8>>>,
}

struct CapturedWriteGuard {
    bytes: Arc<Mutex<Vec<u8>>>,
}

impl<'a> MakeWriter<'a> for CapturedWriter {
    type Writer = CapturedWriteGuard;

    fn make_writer(&'a self) -> Self::Writer {
        CapturedWriteGuard {
            bytes: Arc::clone(&self.bytes),
        }
    }
}

impl Write for CapturedWriteGuard {
    fn write(&mut self, buffer: &[u8]) -> std::io::Result<usize> {
        self.bytes.lock().unwrap().extend_from_slice(buffer);
        Ok(buffer.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

pub(crate) fn capture<T>(operation: impl FnOnce() -> T) -> (T, String) {
    let writer = CapturedWriter::default();
    let subscriber = tracing_subscriber::fmt()
        .without_time()
        .with_ansi(false)
        .with_max_level(tracing::Level::TRACE)
        .with_writer(writer.clone())
        .finish();
    let result = tracing::subscriber::with_default(subscriber, operation);
    let output = String::from_utf8(writer.bytes.lock().unwrap().clone()).unwrap();
    (result, output)
}
