import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/app/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/me/upload
// Recebe multipart/form-data com campo "file" (imagem)
// Faz upload para Supabase Storage e retorna a URL pública
export async function POST(req: NextRequest) {
  try {
    const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
    if (!payload || payload.role !== "owner") return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Storage não configurado" }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 400 });

    // Valida tipo
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: "Tipo de arquivo inválido (jpeg/png/webp)" }, { status: 400 });
    }

    // Valida tamanho (max 3MB)
    if (file.size > 3 * 1024 * 1024) {
      return NextResponse.json({ error: "Arquivo muito grande (max 3MB)" }, { status: 400 });
    }

    const ext = file.type.split("/")[1].replace("jpeg", "jpg");
    const filename = `${payload.shopId}/${Date.now()}.${ext}`;
    const buffer = await file.arrayBuffer();

    const uploadRes = await fetch(
      `${supabaseUrl}/storage/v1/object/products/${filename}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": file.type,
        },
        body: buffer,
      }
    );

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      console.error("Supabase upload error:", err);
      return NextResponse.json({ error: "Falha no upload da imagem" }, { status: 500 });
    }

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/products/${filename}`;
    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
