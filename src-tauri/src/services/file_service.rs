use std::path::PathBuf;

use crate::domain::{
    dto::SubdirEntry,
    file_operations::{DeleteFileCommand, FileCommand, MoveFileCommand},
};
use crate::infrastructure::{fs_ops, watcher};

pub struct FileService;

impl FileService {
    pub fn move_file(source: String, destination: String) -> Result<(), String> {
        tracing::info!(
            source_path = %source,
            destination_path = %destination,
            "[organize] backend move requested"
        );

        let command = MoveFileCommand {
            source_path: PathBuf::from(source),
            destination_path: PathBuf::from(destination),
        };
        match command.execute() {
            Ok(()) => {
                tracing::info!("[organize] backend move completed");
                Ok(())
            }
            Err(err) => {
                tracing::error!(error = %err, "[organize] backend move failed");
                Err(err)
            }
        }
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

    pub fn watch_folder<R: tauri::Runtime>(
        app: tauri::AppHandle<R>,
        path: String,
    ) -> Result<(), String> {
        watcher::watch_folder(app, PathBuf::from(path).as_path())
    }

    pub fn list_subdirectories(path: String) -> Result<Vec<SubdirEntry>, String> {
        fs_ops::list_subdirectories(PathBuf::from(path).as_path())
    }

    pub fn list_all_subdirectories(path: String) -> Result<Vec<String>, String> {
        fs_ops::list_all_subdirectories(PathBuf::from(path).as_path())
    }

    pub fn ensure_category_folders(paths: Vec<String>) -> Result<(), String> {
        fs_ops::ensure_category_folders(paths)
    }
}
