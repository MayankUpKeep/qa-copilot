import { NextResponse } from "next/server";

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req) {
  try {
    const formData = await req.formData();
    const images = [];
    for (let i = 0; i < 3; i++) {
      const file = formData.get(`image${i}`);
      if (file) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        images.push({
          name: file.name,
          type: file.type,
          data: buffer.toString("base64"),
        });
      }
    }
    return NextResponse.json({ images });
  } catch (err) {
    return NextResponse.json({ error: "Image upload failed." }, { status: 400 });
  }
}
