import http2 from 'http2';
import axios from 'axios';

const FINALIZE_URL = "https://reititin.com/api/finalizeMessage";

export const ReititinClient = ({ agentId, onMessage }) => {
  const MESSAGE_ENDPOINT = `/api/agents/messages?agentId=${agentId}`;
  let buffer = "";

  const connectSSE = () => {
    if (buffer) return;
    console.log("Waiting for messages.");

    const client = http2.connect('https://reititin.com');
    const req = client.request({ ':method': 'GET', ':path': MESSAGE_ENDPOINT, 'accept': 'text/event-stream' })
      .setEncoding('utf8');

    req.on('data', chunk => buffer += chunk);

    req.on('end', async () => {
      console.log("Received a message.")
      const lines = buffer.split('\n').map(line => line.trim());
      const chat_id = lines.find(line => line.startsWith('chat_id:'))?.split(': ')[1];
      const agent_id = lines.find(line => line.startsWith('agent_id:'))?.split(': ')[1];
      const rawData = lines.find(line => line.startsWith('data:'))?.replace('data: ', '');
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
