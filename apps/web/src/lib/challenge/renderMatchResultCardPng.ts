export type MatchResultCardRenderInput = {
  title: string;
  arenaLabel: string;
  wagerUsd: string;
  playerCharacterName: string;
  opponentCharacterName: string;
  playerAddressLabel: string;
  opponentAddressLabel: string;
  playerExpressionSrc?: string | null;
  opponentExpressionSrc?: string | null;
  roundsLabel: string;
  correctCount: number;
  wrongCount: number;
  timeoutCount: number;
};

type Point = { x: number; y: number };
type Size = { width: number; height: number };

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  point: Point,
  size: Size,
  radius: number,
  fill: string | CanvasGradient,
  stroke?: string,
) {
  const { x, y } = point;
  const { width, height } = size;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 3,
) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length >= maxLines - 1) break;
      continue;
    }
    line = testLine;
  }

  if (line) lines.push(line);
  const trimmed = lines.slice(0, maxLines);
  trimmed.forEach((content, index) => {
    let output = content;
    if (index === maxLines - 1 && words.join(" ").length > trimmed.join(" ").length) {
      output = `${content.replace(/[.,;:!?-]*$/, "")}...`;
    }
    ctx.fillText(output, x, y + index * lineHeight);
  });
}

function normalizeFamilyName(raw: string, fallback: string) {
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  return trimmed.replace(/^['"]+|['"]+$/g, "");
}

async function resolveFonts() {
  const fallbackDisplay = "Caprasimo";
  const fallbackBody = "Gabarito";

  if (typeof document === "undefined") {
    return {
      display: `"${fallbackDisplay}", serif`,
      body: `"${fallbackBody}", sans-serif`,
    };
  }

  const rootStyles = getComputedStyle(document.documentElement);
  const displayFamily = normalizeFamilyName(rootStyles.getPropertyValue("--font-caprasimo"), fallbackDisplay);
  const bodyFamily = normalizeFamilyName(rootStyles.getPropertyValue("--font-gabarito"), fallbackBody);
  const displayStack = `"${displayFamily}", "${fallbackDisplay}", serif`;
  const bodyStack = `"${bodyFamily}", "${fallbackBody}", sans-serif`;

  if (document.fonts) {
    await document.fonts.ready;
    await Promise.allSettled([
      document.fonts.load(`700 84px ${displayStack}`),
      document.fonts.load(`700 48px ${displayStack}`),
      document.fonts.load(`700 28px ${bodyStack}`),
      document.fonts.load(`500 24px ${bodyStack}`),
    ]);
  }

  return { display: displayStack, body: bodyStack };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function safeFilePart(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function drawPortrait(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  name: string,
  addressLabel: string,
  src: string | null | undefined,
  fallback: string,
  fonts: { display: string; body: string },
) {
  drawRoundedRect(ctx, { x, y }, { width: 632, height: 214 }, 26, "rgba(255,250,240,0.95)", "#6f6559");
  ctx.fillStyle = "rgba(34,34,34,0.56)";
  ctx.font = `700 18px ${fonts.body}`;
  ctx.fillText(label.toUpperCase(), x + 24, y + 34);

  const portraitGradient = ctx.createRadialGradient(x + 100, y + 92, 10, x + 104, y + 108, 84);
  portraitGradient.addColorStop(0, "rgba(255,255,255,0.95)");
  portraitGradient.addColorStop(0.45, "rgba(248,236,212,0.88)");
  portraitGradient.addColorStop(1, "rgba(226,211,181,0.92)");
  drawRoundedRect(ctx, { x: x + 24, y: y + 50 }, { width: 142, height: 142 }, 26, portraitGradient, "#cfbea9");

  if (src) {
    try {
      const img = await loadImage(src);
      ctx.drawImage(img, x + 24, y + 50, 142, 142);
    } catch {
      ctx.fillStyle = "rgba(44,39,36,0.72)";
      ctx.font = `700 52px ${fonts.display}`;
      ctx.fillText(fallback, x + 77, y + 138);
    }
  } else {
    ctx.fillStyle = "rgba(44,39,36,0.72)";
    ctx.font = `700 52px ${fonts.display}`;
    ctx.fillText(fallback, x + 77, y + 138);
  }

  ctx.fillStyle = "#1f1b18";
  ctx.font = `700 42px ${fonts.display}`;
  wrapText(ctx, name, x + 194, y + 104, 406, 42, 2);
  ctx.fillStyle = "rgba(44,39,36,0.68)";
  ctx.font = `700 18px ${fonts.body}`;
  ctx.fillText(addressLabel, x + 194, y + 170);
}

export async function renderMatchResultCardPng(input: MatchResultCardRenderInput): Promise<Blob> {
  const fonts = await resolveFonts();
  const width = 1600;
  const height = 900;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable.");

  const backgroundGradient = ctx.createLinearGradient(0, 0, width, height);
  backgroundGradient.addColorStop(0, "#f7f0e3");
  backgroundGradient.addColorStop(0.58, "#f2e9d8");
  backgroundGradient.addColorStop(1, "#e8decb");
  ctx.fillStyle = backgroundGradient;
  ctx.fillRect(0, 0, width, height);

  drawRoundedRect(ctx, { x: 40, y: 40 }, { width: 1520, height: 820 }, 28, "rgba(255,252,246,0.74)", "#55504a");
  drawRoundedRect(ctx, { x: 74, y: 74 }, { width: 1452, height: 752 }, 24, "rgba(255,248,238,0.88)", "#72695f");

  ctx.fillStyle = "rgba(38,33,29,0.72)";
  ctx.font = `700 24px ${fonts.body}`;
  ctx.fillText("CORA MATCH RESULT", 126, 140);

  ctx.fillStyle = "#1f1b18";
  ctx.font = `700 72px ${fonts.display}`;
  wrapText(ctx, input.title, 126, 228, 1220, 78, 2);

  await drawPortrait(
    ctx,
    126,
    306,
    "Your Scientist",
    input.playerCharacterName,
    input.playerAddressLabel,
    input.playerExpressionSrc,
    input.playerCharacterName.slice(0, 1),
    fonts,
  );
  await drawPortrait(
    ctx,
    842,
    306,
    "Rival Scientist",
    input.opponentCharacterName,
    input.opponentAddressLabel,
    input.opponentExpressionSrc,
    input.opponentCharacterName.slice(0, 1),
    fonts,
  );

  const stats = [
    { label: "Arena", value: input.arenaLabel },
    { label: "Wager", value: `$${input.wagerUsd}` },
    { label: "Rounds", value: input.roundsLabel },
    { label: "Correct", value: `${input.correctCount}` },
    { label: "Wrong / Timeout", value: `${input.wrongCount} / ${input.timeoutCount}` },
  ];

  stats.forEach((stat, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = 126 + col * 454;
    const y = 566 + row * 112;
    drawRoundedRect(ctx, { x, y }, { width: 410, height: 88 }, 22, "rgba(255,255,255,0.76)", "#8b8175");
    ctx.fillStyle = "rgba(48,42,37,0.7)";
    ctx.font = `700 22px ${fonts.body}`;
    ctx.fillText(stat.label.toUpperCase(), x + 24, y + 30);
    ctx.fillStyle = "#1f1b18";
    ctx.font = `700 32px ${fonts.body}`;
    ctx.fillText(stat.value, x + 24, y + 62);
  });

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to render PNG."));
          return;
        }
        resolve(blob);
      },
      "image/png",
      1,
    );
  });
}

export function createMatchResultCardFileName(input: MatchResultCardRenderInput) {
  const title = safeFilePart(input.title || "result");
  const arena = safeFilePart(input.arenaLabel || "arena");
  return `cora-match-result-${arena}-${title}.png`;
}
