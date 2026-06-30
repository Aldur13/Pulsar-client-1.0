import { Router } from "express";
import net from "net";

const router = Router();

// Real Paper server goes here once it exists. Until then this entry's live
// numbers fall back to the mock values below if the ping times out/fails.
const REAL_SERVER_ADDRESS = "play.pulsarclient.example";
const REAL_SERVER_PORT = 25565;

const MOCK_SERVERS = [
  {
    id: "pulsar-main",
    name: "Pulsar Network",
    address: REAL_SERVER_ADDRESS,
    motd: "The official Pulsar Client community server",
    playersOnline: 42,
    maxPlayers: 200,
    icon: null,
  },
  {
    id: "pulsar-creative",
    name: "Pulsar Creative",
    address: "creative.pulsarclient.example",
    motd: "Build, create, share",
    playersOnline: 17,
    maxPlayers: 100,
    icon: null,
  },
  {
    id: "pulsar-skyblock",
    name: "Pulsar Skyblock",
    address: "skyblock.pulsarclient.example",
    motd: "Survive on a floating island",
    playersOnline: 8,
    maxPlayers: 100,
    icon: null,
  },
];

function writeVarInt(value) {
  const bytes = [];
  while (true) {
    if ((value & ~0x7f) === 0) {
      bytes.push(value);
      return Buffer.from(bytes);
    }
    bytes.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
}

function readVarInt(buffer, offset) {
  let value = 0;
  let position = 0;
  let currentOffset = offset;

  while (true) {
    const byte = buffer[currentOffset++];
    value |= (byte & 0x7f) << position;
    if ((byte & 0x80) === 0) break;
    position += 7;
    if (position >= 32) throw new Error("VarInt too big");
  }

  return { value, length: currentOffset - offset };
}

function packPacket(packetId, data) {
  const idBuf = writeVarInt(packetId);
  const body = Buffer.concat([idBuf, data]);
  const lengthBuf = writeVarInt(body.length);
  return Buffer.concat([lengthBuf, body]);
}

function packString(str) {
  const strBuf = Buffer.from(str, "utf8");
  return Buffer.concat([writeVarInt(strBuf.length), strBuf]);
}

// Real Minecraft Server List Ping protocol: handshake packet (with next
// state = 1 for status) followed by an empty status request packet, then we
// read back the status response JSON. See wiki.vg/Server_List_Ping.
function pingServer(address, port = 25565, { timeoutMs = 2000 } = {}) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let settled = false;
    let buffer = Buffer.alloc(0);

    const finish = (err, result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (err) reject(err);
      else resolve(result);
    };

    socket.setTimeout(timeoutMs);

    socket.on("timeout", () => finish(new Error("ping timed out")));
    socket.on("error", (err) => finish(err));

    socket.connect(port, address, () => {
      const handshake = packPacket(
        0x00,
        Buffer.concat([
          writeVarInt(765), // protocol version, value is informational for status pings
          packString(address),
          Buffer.from([(port >> 8) & 0xff, port & 0xff]),
          writeVarInt(1), // next state: 1 = status
        ])
      );
      const statusRequest = packPacket(0x00, Buffer.alloc(0));
      socket.write(Buffer.concat([handshake, statusRequest]));
    });

    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      try {
        const { value: packetLength, length: lenSize } = readVarInt(buffer, 0);
        if (buffer.length < lenSize + packetLength) return; // wait for more data

        let offset = lenSize;
        const { value: packetId, length: idSize } = readVarInt(buffer, offset);
        offset += idSize;
        if (packetId !== 0x00) {
          return finish(new Error(`unexpected packet id ${packetId}`));
        }

        const { value: jsonLength, length: jsonLenSize } = readVarInt(buffer, offset);
        offset += jsonLenSize;
        const jsonStr = buffer.toString("utf8", offset, offset + jsonLength);
        const status = JSON.parse(jsonStr);

        finish(null, {
          playersOnline: status.players?.online ?? null,
          maxPlayers: status.players?.max ?? null,
          motd:
            typeof status.description === "string"
              ? status.description
              : status.description?.text ?? null,
        });
      } catch {
        // partial packet, keep buffering until timeout or full packet arrives
      }
    });
  });
}

router.get("/", async (req, res) => {
  const servers = await Promise.all(
    MOCK_SERVERS.map(async (server) => {
      if (server.id !== "pulsar-main") return server;

      try {
        const live = await pingServer(REAL_SERVER_ADDRESS, REAL_SERVER_PORT, {
          timeoutMs: 1500,
        });
        return {
          ...server,
          playersOnline: live.playersOnline ?? server.playersOnline,
          maxPlayers: live.maxPlayers ?? server.maxPlayers,
          motd: live.motd ?? server.motd,
        };
      } catch {
        // No reachable server from this sandbox (expected) - fall back to mock numbers.
        return server;
      }
    })
  );

  res.json(servers);
});

export default router;
export { pingServer };
