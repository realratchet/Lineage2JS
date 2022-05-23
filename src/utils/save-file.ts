function saveFile(content: Blob, name: string) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(content);
    link.download = name;
    link.click();
    URL.revokeObjectURL(link.href);
}

export default saveFile;
export { saveFile };