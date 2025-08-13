# Documentación de Conexión WebSocket - Sophi Chat

## Resumen
Esta documentación describe la implementación de la conexión WebSocket en `src/App.tsx` para la aplicación Sophi Chat, incluyendo la autenticación, envío y recepción de mensajes, y la estructura de datos utilizada.

## Configuración de Conexión

### URLs y Endpoints
```typescript
const WSS_API_URL = 'https://sophi-wss.sistemaoperaciones.com/api';
const WSS_URL = 'wss://sophi-wss.sistemaoperaciones.com';
```

### Configuración de Socket.IO
La conexión WebSocket se establece usando Socket.IO con la siguiente configuración:

```typescript
socketRef.current = io(WSS_URL, {
  path: '/sophi-wss',
  transports: ['websocket'],
  auth: { 
    token: token  // JWT token obtenido del login
  },
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  forceNew: true,
  timeout: 10000
});
```


## Estructura de Mensajes

### Interfaz Message (UI)
```typescript
interface Message {
  id: string
  content: string
  sender: "user" | "bot"
  timestamp: Date
  type?: "text" | "system" | "audio" | "image" | "transcription"
  audioUrl?: string // URL para reproducir el audio
  graphs?: string[] // URLs de imágenes/gráficos a mostrar
}
```

### Interfaces para Mensajes Enviados por WebSocket

#### Mensaje de Texto
```typescript
interface TextMessagePayload {
  chat_session_id: string
  content: string
  timestamp: string // ISO string
}
```

#### Mensaje de Audio
```typescript
interface AudioMessagePayload {
  type: 'audio'
  content: string // Base64 encoded audio data
  metadata: {
    mimeType: string
    size: number
  }
  chat_session_id: string
}
```

## Envío de Mensajes

### 1. Mensajes de Texto
```typescript
const sendMessage = () => {
  if (inputMessage.trim() && socketRef.current?.connected && activeSession) {
    // Estructura del mensaje de texto
    const messageData: TextMessagePayload = {
      chat_session_id: activeSession.sessionId,
      content: inputMessage,
      timestamp: new Date().toISOString()
    };

    console.log('[SEND] Enviando mensaje:', messageData);
    socketRef.current.emit('message', messageData);
    
    // Agregar mensaje del usuario a la UI
    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      sender: "user",
      timestamp: new Date(),
      type: "text"
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsWaitingResponse(true);
  }
};
```

### 2. Mensajes de Audio
```typescript
const sendAudioMessage = async (audioBlob: Blob) => {
  if (socketRef.current?.connected && activeSession) {
    try {
      // Convertir audio a base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = (reader.result as string).split(',')[1];
        
        // Estructura del mensaje de audio
        const audioMessage: AudioMessagePayload = {
          type: 'audio',
          content: base64Data,
          metadata: {
            mimeType: audioBlob.type,
            size: audioBlob.size
          },
          chat_session_id: activeSession.sessionId
        };
        
        console.log('[AUDIO] Enviando mensaje de audio:', audioMessage);
        socketRef.current.emit('message', JSON.stringify(audioMessage));
        setIsWaitingResponse(true);
      };
      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error('Error al enviar audio:', error);
    }
  }
};
```

## Recepción de Mensajes

### Event Listeners del Socket

#### 1. Conexión Establecida
```typescript
socketRef.current.on('connect', () => {
  console.log('✅ [WEBSOCKET] ¡Conexión establecida exitosamente!');
  setSocketStatus("conectado");
  addSystemMessage("Conexión WebSocket establecida");
});
```

#### 2. Respuesta del Bot (Evento Unificado)
```typescript
socketRef.current.on('message', (data) => {
  console.log('[RECEIVE] Mensaje recibido:', data);
  setIsWaitingResponse(false);
  
  // Parsear datos si vienen como string JSON
  let parsedData;
  try {
    parsedData = typeof data === 'string' ? JSON.parse(data) : data;
  } catch {
    parsedData = data;
  }
  
  // Manejar mensaje de audio
  if (parsedData?.audioData) {
    // Convertir base64 a Blob para reproducción
    const byteCharacters = atob(parsedData.audioData);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const audioBlob = new Blob([byteArray], { 
      type: parsedData.metadata?.mimeType || 'audio/webm' 
    });
    const audioURL = URL.createObjectURL(audioBlob);
    
    const audioMessage: Message = {
      id: (Date.now() + Math.random()).toString(),
      content: parsedData.content || "Audio",
      sender: "bot",
      timestamp: new Date(),
      type: "audio",
      audioUrl: audioURL
    };
    setMessages(prev => [...prev, audioMessage]);
    return;
  }
  
  // Manejar mensaje de texto
  const textContent = parsedData?.content || parsedData?.message || 'Respuesta vacía';
  const graphs = parsedData?.quoteData?.graphs?.map((graph: string) => 
    `https://sophi-agent.sistemaoperaciones.com${graph}`
  ) || [];
  
  const botMessage: Message = {
    id: (Date.now() + Math.random()).toString(),
    content: textContent,
    sender: "bot",
    timestamp: new Date(),
    type: "text",
    graphs: graphs
  };
  
  setMessages(prev => [...prev, botMessage]);
});
```

#### 4. Manejo de Errores
```typescript
socketRef.current.on('error', (error) => {
  console.error('[WEBSOCKET] Error:', error);
  setSocketStatus("error");
  addSystemMessage(`Error de conexión: ${error.message || error}`);
});

socketRef.current.on('disconnect', (reason) => {
  console.log('[WEBSOCKET] Desconectado:', reason);
  setSocketStatus("desconectado");
  addSystemMessage(`Conexión perdida: ${reason}`);
});

socketRef.current.on('connect_error', (error) => {
  console.error('[WEBSOCKET] Error de conexión:', error);
  setSocketStatus("error");
  addSystemMessage(`Error al conectar: ${error.message}`);
});
```

## Eventos WebSocket Disponibles

### Eventos que se Envían (emit)
- `message`: Enviar mensaje de texto o audio (evento unificado)
  - Para texto: objeto `TextMessagePayload`
  - Para audio: string JSON de `AudioMessagePayload`

### Eventos que se Reciben (on)
- `connect`: Conexión establecida
- `disconnect`: Conexión perdida
- `connect_error`: Error de conexión
- `error`: Error general
- `message`: Respuesta del bot (texto, audio, o datos estructurados)
  - Puede contener: `content`, `audioData`, `graphs`, etc.

## Estados de Conexión

La aplicación maneja los siguientes estados de conexión:
- `"desconectado"`: Sin conexión
- `"conectando"`: Estableciendo conexión
- `"conectado"`: Conexión activa
- `"error"`: Error en la conexión


## Flujo Completo de Comunicación

1. **Autenticación**: Obtener token JWT del endpoint de auth
2. **Gestión de Sesión**: Obtener o crear sesión de chat
3. **Conexión WebSocket**: Establecer conexión con token y sessionId
4. **Envío de Mensajes**: Emit eventos con datos del mensaje
5. **Recepción de Respuestas**: Escuchar eventos de respuesta
6. **Manejo de Errores**: Gestionar desconexiones y errores
7. **Persistencia**: Guardar estado en localStorage para continuidad

## Consideraciones de Seguridad

- El token JWT se envía en el campo `auth` de Socket.IO
- El sessionId se incluye en headers y query parameters
- Todos los endpoints API requieren autenticación Bearer
- El token se almacena en localStorage para persistencia
- Se valida la expiración del token y se maneja el logout automático
