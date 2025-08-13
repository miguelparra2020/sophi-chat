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

### Interfaz Message
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

## Envío de Mensajes

### 1. Mensajes de Texto
```typescript
const sendMessage = () => {
  if (inputMessage.trim() && socketRef.current && isConnected) {
    const messageData = {
      message: inputMessage,
      sessionId: activeSession?.sessionId,
      userId: userInfo?.id,
      username: userInfo?.username,
      timestamp: new Date().toISOString(),
      messageType: 'text'
    };

    console.log('[SEND] Enviando mensaje:', messageData);
    socketRef.current.emit('chat_message', messageData);
    
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
  if (socketRef.current && isConnected && activeSession) {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.wav');
    formData.append('sessionId', activeSession.sessionId);
    formData.append('userId', userInfo?.id.toString() || '');
    formData.append('username', userInfo?.username || '');
    formData.append('timestamp', new Date().toISOString());
    formData.append('messageType', 'audio');

    console.log('[AUDIO] Enviando mensaje de audio...');
    socketRef.current.emit('audio_message', formData);
    setIsWaitingResponse(true);
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

#### 2. Respuesta de Chat
```typescript
socketRef.current.on('chat_response', (data) => {
  console.log('[RECEIVE] Respuesta de chat recibida:', data);
  setIsWaitingResponse(false);
  
  const botMessage: Message = {
    id: (Date.now() + Math.random()).toString(),
    content: data.message || data.response || 'Respuesta vacía',
    sender: "bot",
    timestamp: new Date(),
    type: "text",
    graphs: data.graphs || []
  };
  
  setMessages(prev => [...prev, botMessage]);
});
```

#### 3. Respuesta de Audio
```typescript
socketRef.current.on('audio_response', (data) => {
  console.log('[RECEIVE] Respuesta de audio recibida:', data);
  setIsWaitingResponse(false);
  
  if (data.transcription) {
    // Mensaje con transcripción
    const transcriptionMessage: Message = {
      id: (Date.now() + Math.random()).toString(),
      content: data.transcription,
      sender: "user",
      timestamp: new Date(),
      type: "transcription"
    };
    setMessages(prev => [...prev, transcriptionMessage]);
  }
  
  if (data.audioUrl) {
    // Mensaje con audio del bot
    const audioMessage: Message = {
      id: (Date.now() + Math.random() + 1).toString(),
      content: data.message || "Respuesta de audio",
      sender: "bot",
      timestamp: new Date(),
      type: "audio",
      audioUrl: data.audioUrl
    };
    setMessages(prev => [...prev, audioMessage]);
  }
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
- `chat_message`: Enviar mensaje de texto
- `audio_message`: Enviar mensaje de audio

### Eventos que se Reciben (on)
- `connect`: Conexión establecida
- `disconnect`: Conexión perdida
- `connect_error`: Error de conexión
- `error`: Error general
- `chat_response`: Respuesta de texto del bot
- `audio_response`: Respuesta de audio del bot

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
