import { NextRequest, NextResponse } from "next/server";
import {
  requireAdminUser,
  AdminAuthError,
} from "@/lib/admin-auth";

export const runtime = "nodejs";

/*
 * クライアント（Section 10）が「このユーザーはAdminか」を
 * 判定するためだけのエンドポイント。
 *
 * これはUI表示の可否を決めるためのものであり、
 * 実際のデータ操作を行うAdmin API（companies / analyze / commit）は
 * それぞれが個別にrequireAdminUser()を呼び出して検証する。
 * このエンドポイントの結果をクライアントが偽装しても、
 * 他のAdmin APIへは影響しない。
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAdminUser(req);

    return NextResponse.json({
      isAdmin: true,
      email: user.email,
    });
  } catch (e: any) {
    if (e instanceof AdminAuthError) {
      return NextResponse.json(
        { isAdmin: false },
        { status: e.status }
      );
    }

    return NextResponse.json(
      { isAdmin: false, error: e?.message },
      { status: 500 }
    );
  }
}
