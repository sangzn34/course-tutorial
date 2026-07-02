import { saveImage } from "@/lib/storage";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return Response.json({ message: "ไม่พบไฟล์" }, { status: 400 });
  }

  try {
    const url = await saveImage(file);
    return Response.json({ url });
  } catch (err) {
    console.error("upload error:", err);
    return Response.json({ message: "อัปโหลดไม่สำเร็จ" }, { status: 500 });
  }
}
