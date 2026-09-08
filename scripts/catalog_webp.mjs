// Structural WebP validation is deliberately separate from pixel and visual QA.
export function readNormalizedWebpDimensions(bytes) {
  const fail = (message) => { throw new Error(message) }
  if (bytes.length < 30 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") {
    fail("a catalog file is not a RIFF WebP image")
  }
  if (bytes.readUInt32LE(4) + 8 !== bytes.length) fail("a WebP RIFF length does not exactly match the file")
  const chunks = []
  let offset = 12
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) fail("a WebP has a truncated chunk header")
    const name = bytes.toString("ascii", offset, offset + 4)
    const length = bytes.readUInt32LE(offset + 4)
    const dataStart = offset + 8
    const dataEnd = dataStart + length
    const paddedEnd = dataEnd + length % 2
    if (dataEnd > bytes.length || paddedEnd > bytes.length) fail(`a WebP ${JSON.stringify(name)} chunk exceeds the RIFF boundary`)
    if (length % 2 === 1 && bytes[dataEnd] !== 0) fail(`a WebP ${JSON.stringify(name)} chunk has non-zero padding`)
    chunks.push({ name, dataStart, length })
    offset = paddedEnd
  }
  if (offset !== bytes.length) fail("a WebP has trailing bytes")
  if (chunks.length !== 1 || !["VP8 ", "VP8L"].includes(chunks[0].name)) {
    fail("normalized catalog WebP may contain only one VP8/VP8L image chunk (no metadata or animation)")
  }
  const { name, dataStart, length } = chunks[0]
  if (name === "VP8 ") {
    if (length < 10 || bytes[dataStart + 3] !== 0x9d || bytes[dataStart + 4] !== 0x01 || bytes[dataStart + 5] !== 0x2a) {
      fail("a VP8 image has an invalid key-frame signature")
    }
    return [bytes.readUInt16LE(dataStart + 6) & 0x3fff, bytes.readUInt16LE(dataStart + 8) & 0x3fff]
  }
  if (length < 5 || bytes[dataStart] !== 0x2f) fail("a VP8L image has an invalid signature")
  const packed = bytes.readUInt32LE(dataStart + 1)
  return [(packed & 0x3fff) + 1, ((packed >>> 14) & 0x3fff) + 1]
}
