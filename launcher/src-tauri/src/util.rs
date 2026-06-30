use futures_util::StreamExt;
use sha1::{Digest, Sha1};
use std::path::Path;

pub fn sha1_hex_of_file(path: &Path) -> std::io::Result<String> {
    let bytes = std::fs::read(path)?;
    let mut hasher = Sha1::new();
    hasher.update(&bytes);
    Ok(hex::encode(hasher.finalize()))
}

pub fn file_matches(path: &Path, expected_size: Option<u64>, expected_sha1: Option<&str>) -> bool {
    let Ok(metadata) = std::fs::metadata(path) else {
        return false;
    };
    if let Some(size) = expected_size {
        if metadata.len() != size {
            return false;
        }
    }
    if let Some(sha1) = expected_sha1 {
        if !sha1.is_empty() {
            match sha1_hex_of_file(path) {
                Ok(actual) => return actual.eq_ignore_ascii_case(sha1),
                Err(_) => return false,
            }
        }
    }
    true
}

pub async fn download_to_file(
    client: &reqwest::Client,
    url: &str,
    dest: &Path,
    mut on_chunk: impl FnMut(u64),
) -> Result<(), String> {
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("GET {url} failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("GET {url} returned status {}", resp.status()));
    }

    let tmp_path = dest.with_extension("part");
    {
        let mut file = std::fs::File::create(&tmp_path).map_err(|e| e.to_string())?;
        let mut stream = resp.bytes_stream();
        use std::io::Write;
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| format!("error streaming {url}: {e}"))?;
            file.write_all(&chunk).map_err(|e| e.to_string())?;
            on_chunk(chunk.len() as u64);
        }
    }
    std::fs::rename(&tmp_path, dest).map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn download_verified(
    client: &reqwest::Client,
    url: &str,
    dest: &Path,
    expected_size: Option<u64>,
    expected_sha1: Option<&str>,
    mut on_chunk: impl FnMut(u64),
) -> Result<(), String> {
    if file_matches(dest, expected_size, expected_sha1) {
        if let Some(size) = expected_size {
            on_chunk(size);
        }
        return Ok(());
    }
    download_to_file(client, url, dest, &mut on_chunk).await?;
    if !file_matches(dest, expected_size, expected_sha1) {
        let _ = std::fs::remove_file(dest);
        return Err(format!("checksum/size mismatch after downloading {url}"));
    }
    Ok(())
}
