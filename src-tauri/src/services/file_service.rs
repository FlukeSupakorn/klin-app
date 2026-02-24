use std::path::PathBuf;

use crate::domain::file_command::{DeleteFileCommand, FileCommand, MoveFileCommand};
use crate::infrastructure::fs_ops;

pub struct FileService;

impl FileService {
    pub fn move_file(source: String, destination: String) -> Result<(), String> {
        let command = MoveFileCommand {
            source_path: PathBuf::from(source),
            destination_path: PathBuf::from(destination),
        };
        command.execute()
    }

    pub fn read_folder(path: String) -> Result<Vec<String>, String> {
        fs_ops::read_folder(PathBuf::from(path).as_path())
    }

    pub fn delete_file(path: String) -> Result<(), String> {
        let command = DeleteFileCommand {
            file_path: PathBuf::from(path),
        };
        command.execute()
    }
}
