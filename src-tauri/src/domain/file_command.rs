use std::path::PathBuf;

use crate::infrastructure::fs_ops;

pub trait FileCommand {
    fn execute(&self) -> Result<(), String>;
}

pub struct MoveFileCommand {
    pub source_path: PathBuf,
    pub destination_path: PathBuf,
}

impl FileCommand for MoveFileCommand {
    fn execute(&self) -> Result<(), String> {
        fs_ops::move_file(&self.source_path, &self.destination_path)
    }
}

pub struct DeleteFileCommand {
    pub file_path: PathBuf,
}

impl FileCommand for DeleteFileCommand {
    fn execute(&self) -> Result<(), String> {
        fs_ops::delete_file(&self.file_path)
    }
}
