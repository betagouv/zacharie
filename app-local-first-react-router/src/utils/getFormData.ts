export async function getFormData(request: Request): Promise<FormData> {
  try {
    return await request.formData();
  } catch (e) {
    const text = await request.text();
    const formData = new FormData();
    text.split("&").forEach((pair) => {
      const [key, value] = pair.split("=");
      if (key && value) {
        formData.append(decodeURIComponent(key), decodeURIComponent(value.replace(/\+/g, " ")));
      }
    });
    return formData;
  }
}
