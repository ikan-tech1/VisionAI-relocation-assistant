import { NextRequest, NextResponse } from "next/server";

function unauthorizedResponse(): NextResponse {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="VisionAI Relocation Assistant", charset="UTF-8"',
    },
  });
}

export function proxy(request: NextRequest) {
  const expectedUser = process.env.BASIC_AUTH_USER;
  const expectedPass = process.env.BASIC_AUTH_PASS;

  if (!expectedUser || !expectedPass) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Basic ")) {
    return unauthorizedResponse();
  }

  const encodedCredentials = authHeader.replace("Basic ", "");
  let decoded = "";
  try {
    decoded = atob(encodedCredentials);
  } catch {
    return unauthorizedResponse();
  }

  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex < 0) return unauthorizedResponse();

  const username = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);

  if (username !== expectedUser || password !== expectedPass) {
    return unauthorizedResponse();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
