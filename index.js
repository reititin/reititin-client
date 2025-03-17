import http2 from 'http2';
import axios from 'axios';

export const ReititinClient = ({ agentId, onMessage }) => {
  const MESSAGE_ENDPOINT = `/api/agents/messages?agentId=${agentId}`;
  const FINALIZE_URL = "https://test.reititin.com/api/finalizeMessage";
  let buffer = "";

  const connectSSE = () => {
    if (buffer) return;
    
    console.log("Waiting for messages.");

    const client = http2.connect('https://test.reititin.com');
    const req = client.request({ ':method': 'GET', ':path': MESSAGE_ENDPOINT, 'accept': 'text/event-stream' })
      .setEncoding('utf8');

    req.on('data', chunk => buffer += chunk);

    req.on('end', async () => {
      try {
        const lines = buffer.split('\n').map(line => line.trim());
        const chat_id = lines.find(line => line.startsWith('chat_id:'))?.split(': ')[1];
        const agent_id = lines.find(line => line.startsWith('agent_id:'))?.split(': ')[1];
        const rawData = lines.find(line => line.startsWith('data:'))?.replace('data: ', '');
        if (onMessage && rawData && agent_id && chat_id) {
          console.log("Message received. Processing.");
          const processedMessage = await onMessage(JSON.parse(rawData));
          await axios.post(FINALIZE_URL, { chat_id: chat_id, agent_id: agent_id, message: processedMessage });
          console.log(`Response sent.`);
        }
        buffer = "";
      } catch(err) {
        console.log("Reconnecting.");
      }
      scheduleReconnect();
    });

    req.on('error', err => {
      console.error('Connection closed. Reconnecting.');
      req.close();
      client.close();
      scheduleReconnect();
    });

    req.on('timeout', err => {
      console.error('Connection timedout. Reconnecting.');
      req.close();
      client.close();
      scheduleReconnect();
    });

    req.end();
  };

  const scheduleReconnect = () => setTimeout(connectSSE, 1000);

  connectSSE();
};
