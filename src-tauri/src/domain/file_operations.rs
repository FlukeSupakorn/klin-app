use std::path::PathBuf;

pub trait FileCommand {
    fn execute(&self) -> Result<(), String>;
}

pub struct MoveFileCommand {
    pub source_path: PathBuf,
    pub destination_path: PathBuf,
}

pub struct DeleteFileCommand {
    pub file_path: PathBuf,
}
