export type ChallengeCardRenderInput = {
  title: string;
  challengerAddress: string;
  statusLabel: string;
  description?: string | null;
  token: string;
  wagerUsd: string;
  arenaLabel: string;
  challengeLink: string;
  eyebrowLabel?: string;
  characterExpressionSrc?: string | null;
  showCharacterPortrait?: boolean;
};

type Point = { x: number; y: number };
type Size = { width: number; height: number };
type RenderFontStacks = {
  display: string;
  body: string;
};

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

  return trimmed.length;
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

function shortenAddress(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 5)}...${address.slice(-4)}`;
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, startingSize: number, family: string, minSize: number) {
  let size = startingSize;
  while (size > minSize) {
    ctx.font = `700 ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) {
      return size;
    }
    size -= 1;
  }
  return minSize;
}

function normalizeFamilyName(raw: string, fallback: string) {
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  return trimmed.replace(/^['"]+|['"]+$/g, "");
}

async function resolveRenderFonts(): Promise<RenderFontStacks> {
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
      document.fonts.load(`700 96px ${displayStack}`),
      document.fonts.load(`700 62px ${displayStack}`),
      document.fonts.load(`700 30px ${bodyStack}`),
      document.fonts.load(`700 34px ${bodyStack}`),
      document.fonts.load(`500 36px ${bodyStack}`),
      document.fonts.load(`500 22px ${bodyStack}`),
    ]);
  }

  return {
    display: displayStack,
    body: bodyStack,
  };
}

export async function renderChallengeCardJpg(input: ChallengeCardRenderInput): Promise<Blob> {
  const fonts = await resolveRenderFonts();
  const width = 1600;
  const height = 900;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context unavailable.");
  }
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  const backgroundGradient = ctx.createLinearGradient(0, 0, width, height);
  backgroundGradient.addColorStop(0, "#f7f0e3");
  backgroundGradient.addColorStop(0.58, "#f2e9d8");
  backgroundGradient.addColorStop(1, "#e8decb");
  ctx.fillStyle = backgroundGradient;
  ctx.fillRect(0, 0, width, height);

  drawRoundedRect(ctx, { x: 34, y: 34 }, { width: 1532, height: 832 }, 20, "rgba(255,252,246,0.72)", "#2f2f2f");
  drawRoundedRect(ctx, { x: 56, y: 56 }, { width: 1488, height: 788 }, 18, "rgba(255,248,238,0.82)", "#545454");

  const leftZoneGradient = ctx.createLinearGradient(84, 96, 934, 766);
  leftZoneGradient.addColorStop(0, "#fffaf0");
  leftZoneGradient.addColorStop(1, "#f2e7d3");
  drawRoundedRect(ctx, { x: 84, y: 96 }, { width: 850, height: 670 }, 16, leftZoneGradient, "#6a6a6a");

  const rightZoneGradient = ctx.createLinearGradient(960, 96, 1518, 766);
  rightZoneGradient.addColorStop(0, "#f8f1e5");
  rightZoneGradient.addColorStop(1, "#ede2cf");
  drawRoundedRect(ctx, { x: 960, y: 96 }, { width: 558, height: 670 }, 16, rightZoneGradient, "#6a6a6a");

  const eyebrowLabel = input.eyebrowLabel ?? "CORA CHALLENGE";
  const hasDescription = Boolean(input.description?.trim());
  const showCharacterPortrait = input.showCharacterPortrait ?? true;
  const shortWallet = shortenAddress(input.challengerAddress);
  let hasLoadedPortraitImage = false;

  if (showCharacterPortrait) {
    if (input.characterExpressionSrc) {
      try {
        const expressionImage = await loadImage(input.characterExpressionSrc);
        hasLoadedPortraitImage = true;
        drawRoundedRect(ctx, { x: 120, y: 176 }, { width: 154, height: 154 }, 28, "rgba(252,244,228,0.98)", "#7a6d60");
        const portraitGradient = ctx.createRadialGradient(164, 214, 18, 196, 246, 118);
        portraitGradient.addColorStop(0, "rgba(255,255,255,0.96)");
        portraitGradient.addColorStop(0.42, "rgba(248,236,212,0.88)");
        portraitGradient.addColorStop(1, "rgba(226,211,181,0.92)");
        drawRoundedRect(ctx, { x: 128, y: 184 }, { width: 138, height: 138 }, 24, portraitGradient, "#cab8a0");
        ctx.drawImage(expressionImage, 128, 184, 138, 138);
      } catch {
        hasLoadedPortraitImage = false;
      }
    }
  }

  ctx.fillStyle = "rgba(38,33,29,0.72)";
  ctx.font = `700 24px ${fonts.body}`;
  const usePortraitOffset = showCharacterPortrait && hasLoadedPortraitImage;
  const textStartX = usePortraitOffset ? 304 : 128;
  const titleMaxWidth = usePortraitOffset ? 572 : 620;
  ctx.fillText(eyebrowLabel.toUpperCase(), textStartX, 144);

  ctx.fillStyle = "#1f1b18";
  const titleFontSize = usePortraitOffset ? 76 : 70;
  ctx.font = `700 ${titleFontSize}px ${fonts.display}`;
  const titleLineHeight = usePortraitOffset ? 78 : 72;
  const titleLineCount = wrapText(
    ctx,
    input.title,
    textStartX,
    230,
    titleMaxWidth,
    titleLineHeight,
    usePortraitOffset ? 3 : 3,
  );

  const pillsY = 230 + Math.max(titleLineCount - 1, 0) * titleLineHeight + 28;
  drawRoundedRect(ctx, { x: textStartX, y: pillsY }, { width: 250, height: 52 }, 26, "rgba(255,255,255,0.7)", "#6c645c");
  ctx.fillStyle = "#22201d";
  ctx.font = `700 22px ${fonts.body}`;
  ctx.textBaseline = "middle";
  ctx.fillText(input.statusLabel.toUpperCase(), textStartX + 28, pillsY + 26);

  const walletPillX = textStartX + 268;
  const walletPillWidth = usePortraitOffset ? 262 : 300;
  drawRoundedRect(ctx, { x: walletPillX, y: pillsY }, { width: walletPillWidth, height: 52 }, 26, "rgba(255,255,255,0.58)", "#857b71");
  ctx.fillStyle = "rgba(50,43,38,0.78)";
  ctx.font = `700 21px ${fonts.body}`;
  ctx.fillText("WALLET", walletPillX + 26, pillsY + 26);
  ctx.fillStyle = "rgba(50,43,38,0.82)";
  const walletFontSize = fitText(ctx, shortWallet, walletPillWidth - 118, 24, fonts.body, 18);
  ctx.font = `700 ${walletFontSize}px ${fonts.body}`;
  ctx.fillText(shortWallet, walletPillX + 118, pillsY + 26);
  ctx.textBaseline = "alphabetic";

  if (hasDescription) {
    ctx.fillStyle = "rgba(52,46,41,0.86)";
    ctx.font = `500 31px ${fonts.body}`;
    wrapText(ctx, input.description ?? "", textStartX, pillsY + 96, titleMaxWidth + 4, 38, 3);
  }

  drawRoundedRect(ctx, { x: 996, y: 136 }, { width: 486, height: 334 }, 14, "rgba(255,255,255,0.74)", "#6a6a6a");
  drawRoundedRect(ctx, { x: 1097, y: 162 }, { width: 284, height: 282 }, 10, "#f3ebdc", "#8d8376");
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=246x246&margin=0&data=${encodeURIComponent(input.challengeLink)}`;
  try {
    const qrImage = await loadImage(qrUrl);
    ctx.drawImage(qrImage, 1116, 180, 246, 246);
  } catch {
    ctx.fillStyle = "rgba(44,39,36,0.62)";
    ctx.font = `600 26px ${fonts.body}`;
    ctx.fillText("QR unavailable", 1140, 326);
  }

  const metrics = [
    { label: "TOKEN", value: input.token },
    { label: "WAGER", value: `$${input.wagerUsd}` },
    { label: "ARENA", value: input.arenaLabel },
  ];
  metrics.forEach((metric, index) => {
    const boxY = 500 + index * 86;
    const boxHeight = 72;
    const boxCenterY = boxY + boxHeight / 2;
    drawRoundedRect(ctx, { x: 996, y: boxY }, { width: 486, height: boxHeight }, 10, "rgba(255,255,255,0.72)", "#7a7065");
    ctx.fillStyle = "rgba(48,42,37,0.7)";
    ctx.font = `700 22px ${fonts.body}`;
    ctx.textBaseline = "middle";
    ctx.fillText(metric.label, 1020, boxCenterY);
    ctx.fillStyle = "#1f1b18";
    const metricFontSize = fitText(ctx, metric.value, 286, metric.label === "ARENA" ? 28 : 30, fonts.body, 20);
    ctx.font = `700 ${metricFontSize}px ${fonts.body}`;
    ctx.textAlign = "right";
    ctx.fillText(metric.value, 996 + 486 - 24, boxCenterY);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  });

  drawRoundedRect(ctx, { x: 84, y: 790 }, { width: 1434, height: 40 }, 10, "rgba(255,255,255,0.68)", "#7d7368");
  ctx.fillStyle = "rgba(45,39,35,0.74)";
  ctx.font = `500 20px ${fonts.body}`;
  wrapText(ctx, input.challengeLink, 100, 818, 1400, 24, 1);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to render JPG."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      0.92,
    );
  });
}

export function createChallengeCardFileName(input: ChallengeCardRenderInput) {
  const arena = safeFilePart(input.arenaLabel || "arena");
  const title = safeFilePart(input.title || "challenge");
  return `cora-challenge-${arena}-${title}.jpg`;
}
