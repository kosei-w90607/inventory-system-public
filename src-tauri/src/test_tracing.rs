use std::collections::HashMap;
use std::io::Write;
use std::sync::{Arc, Mutex, Once, OnceLock};
use std::thread::ThreadId;
use tracing_subscriber::fmt::MakeWriter;

static INSTALL_SUBSCRIBER: Once = Once::new();
static CAPTURED_BYTES: OnceLock<Arc<Mutex<HashMap<ThreadId, Vec<u8>>>>> = OnceLock::new();

#[derive(Clone)]
struct CapturedWriter {
    bytes: Arc<Mutex<HashMap<ThreadId, Vec<u8>>>>,
}

struct CapturedWriteGuard {
    thread_id: ThreadId,
    bytes: Arc<Mutex<HashMap<ThreadId, Vec<u8>>>>,
}

impl<'a> MakeWriter<'a> for CapturedWriter {
    type Writer = CapturedWriteGuard;

    fn make_writer(&'a self) -> Self::Writer {
        CapturedWriteGuard {
            thread_id: std::thread::current().id(),
            bytes: Arc::clone(&self.bytes),
        }
    }
}

impl Write for CapturedWriteGuard {
    fn write(&mut self, buffer: &[u8]) -> std::io::Result<usize> {
        self.bytes
            .lock()
            .unwrap()
            .entry(self.thread_id)
            .or_default()
            .extend_from_slice(buffer);
        Ok(buffer.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

pub(crate) fn capture<T>(operation: impl FnOnce() -> T) -> (T, String) {
    let captured = Arc::clone(
        CAPTURED_BYTES.get_or_init(|| Arc::new(Mutex::new(HashMap::<ThreadId, Vec<u8>>::new()))),
    );
    INSTALL_SUBSCRIBER.call_once(|| {
        let subscriber = tracing_subscriber::fmt()
            .without_time()
            .with_ansi(false)
            .with_max_level(tracing::Level::TRACE)
            .with_writer(CapturedWriter {
                bytes: Arc::clone(&captured),
            })
            .finish();
        tracing::subscriber::set_global_default(subscriber)
            .expect("test tracing subscriber must install exactly once");
    });
    let thread_id = std::thread::current().id();
    captured.lock().unwrap().remove(&thread_id);
    let result = operation();
    let bytes = captured
        .lock()
        .unwrap()
        .remove(&thread_id)
        .unwrap_or_default();
    let output = String::from_utf8(bytes).unwrap();
    (result, output)
}
