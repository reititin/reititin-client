import http2 from 'http2';
import axios from 'axios';

const FINALIZE_URL = "https://apukone.com/api/finalizeMessage";

export const createApukoneClient = ({ agentId, onMessage }) => {
  const SSE_ENDPOINT = `/api/agents/messages?agentId=${agentId}`;
  let buffer = "";

  const connectSSE = () => {
    if (buffer) return;
    console.log("Waiting for messages.");

    const client = http2.connect('https://apukone.com');
    const req = client.request({ ':method': 'GET', ':path': SSE_ENDPOINT, 'accept': 'text/event-stream' })
      .setEncoding('utf8');

    req.on('data', chunk => buffer += chunk);

    req.on('end', async () => {
      console.log("Received a message.")
      const [id, chat_id, agent_id, rawData] = buffer.split('\n')
        .map(line => line.split(': ')[1]);

      if (onMessage) {
        const processedMessage = await onMessage(rawData);
        await axios.post(FINALIZE_URL, { chat_id: chat_id, agent_id: agent_id, message: processedMessage });
        console.log(`Response sent.`);
      }

      buffer = "";
      scheduleReconnect();
    });

    req.on('error', err => {
      console.error('Connection error:', err);
      client.close();
      scheduleReconnect();
    });

    req.end();
  };

  const scheduleReconnect = () => setTimeout(connectSSE, 1000);

  connectSSE();
};
