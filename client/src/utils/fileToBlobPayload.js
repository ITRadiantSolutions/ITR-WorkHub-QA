export const fileToBlobPayload = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const contentBase64 = String(reader.result).split(",")[1];
      resolve({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        contentBase64,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
