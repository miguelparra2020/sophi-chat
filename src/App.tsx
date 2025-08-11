import type React from "react"

import { useState, useRef, useEffect } from "react"
import { io, Socket } from "socket.io-client"
import { Send, Settings, User, Bot, Mic, X, Power, Lock, AtSign, Loader2, ExternalLink, Download } from "lucide-react"
import { Button } from "./components/ui/button"
import { Input } from "./components/ui/input"
import { Card } from "./components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "./components/ui/avatar"
import { Badge } from "./components/ui/badge"
import { Separator } from "./components/ui/separator"

interface Message {
  id: string
  content: string
  sender: "user" | "bot"
  timestamp: Date
  type?: "text" | "system" | "audio" | "image" | "transcription"
  audioUrl?: string // URL para reproducir el audio
  graphs?: string[] // URLs de imágenes/gráficos a mostrar
}

export default function ChatInterface() {
  // Estado para mensajes vacío inicialmente
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [isWaitingResponse, setIsWaitingResponse] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [userInfo, setUserInfo] = useState<any | null>(null)

  console.log("userInfo:", userInfo)

  // Efecto para cargar el token desde localStorage al iniciar
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    if (storedToken) {
      console.log('🔌 [INIT] Token encontrado en localStorage. Autenticando...');
      setAuthToken(storedToken);
      setIsConnected(true);
      connectWebSocket(storedToken);
      fetchUserInfo(storedToken); // Obtener info del usuario al cargar
    } else {
      console.log('🚪 [INIT] No se encontró token. Mostrando modal de login.');
      setShowLoginModal(true);
    }
  }, []);
  const [loginError, setLoginError] = useState<string | null>(null)
  const [socketStatus, setSocketStatus] = useState<string>("desconectado")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const socketRef = useRef<Socket | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  console.log("socketStatus", socketStatus)
  // Función para mostrar el modal de login
  const openLoginModal = () => {
    setShowSettingsModal(false)
    setShowLoginModal(true)
    setLoginError(null)
  }

  const fetchUserInfo = async (token: string) => {
    console.log('ℹ️ [USER] Obteniendo información del usuario...');
    try {
      const response = await fetch('https://sophi-auth.sistemaoperaciones.com/api/users/user/info/', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.warn('⚠️ [USER] Token inválido o expirado. Cerrando sesión.');
          closeChat();
        }
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const userData = await response.json();
      console.log('👤 [USER] Información del usuario obtenida:', userData);
      setUserInfo(userData);
      localStorage.setItem('userInfo', JSON.stringify(userData));
    } catch (error) {
      console.error('💥 [USER] Error al obtener la información del usuario:', error);
    }
  };

  // Función para autenticar y luego iniciar el chat
  const handleLogin = async () => {
    console.log('🔐 [AUTH] Iniciando proceso de autenticación...');
    try {
      setLoginError(null)
      
      if (!username || !password) {
        console.log('❌ [AUTH] Validación fallida: campos vacíos');
        setLoginError('Por favor ingresa usuario y contraseña')
        return
      }
      
      console.log('✅ [AUTH] Validación de campos exitosa');
      console.log('👤 [AUTH] Usuario:', username);
      
      // Mostrar mensaje de conexión en progreso
      setShowLoginModal(false)
      setMessages([
        {
          id: Date.now().toString(),
          content: "Autenticando...",
          sender: "bot",
          timestamp: new Date(),
          type: "system",
        }
      ])
      
      const credentials = {
        username,
        password
      };
      
      console.log('📡 [AUTH] Enviando petición de autenticación a:', 'https://sophi-auth.sistemaoperaciones.com/api/users/token/');
      console.log('📦 [AUTH] Credenciales preparadas (password oculta por seguridad)');
      
      const response = await fetch('https://sophi-auth.sistemaoperaciones.com/api/users/token/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentials)
      });
      
      console.log('📨 [AUTH] Respuesta recibida - Status:', response.status, response.statusText);
      
      if (!response.ok) {
        console.log('❌ [AUTH] Error HTTP:', response.status, response.statusText);
        throw new Error(`Error HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📋 [AUTH] Datos de respuesta:', data);
      
      if (data && data.access) {
        const token = data.access;
        console.log('🎟️ [AUTH] Token JWT obtenido exitosamente');
        console.log('🔑 [AUTH] Token (primeros 20 caracteres):', token.substring(0, 20) + '...');
        
        setAuthToken(token)
        localStorage.setItem('authToken', token); // Guardar token en localStorage
        setIsConnected(true)
        
        console.log('🔌 [AUTH] Iniciando conexión WebSocket con token...');
        // Conectar al WebSocket después de autenticar
        connectWebSocket(token);
        // Obtener la información del usuario
        fetchUserInfo(token);
        
        // Mostrar mensajes iniciales
        setMessages([
          {
            id: Date.now().toString(),
            content: "Autenticación exitosa. Token obtenido.",
            sender: "bot",
            timestamp: new Date(),
            type: "system",
          }
        ])
        
        console.log('✅ [AUTH] Proceso de autenticación completado exitosamente');
      } else {
        console.log('❌ [AUTH] Respuesta inválida: no se encontró token de acceso');
        console.log('📋 [AUTH] Estructura de respuesta recibida:', Object.keys(data));
        throw new Error('No se recibió un token válido');
      }
    } catch (error) {
      console.error('💥 [AUTH] Error en el proceso de autenticación:', error);
      console.error('📍 [AUTH] Tipo de error:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('📄 [AUTH] Mensaje de error:', error instanceof Error ? error.message : error);
      
      // Mostrar mensaje de error
      setIsConnected(false)
      setLoginError(error instanceof Error ? error.message : 'Error desconocido')
      setShowLoginModal(true)
      setMessages([
        {
          id: Date.now().toString(),
          content: `Error de autenticación: ${error instanceof Error ? error.message : 'Error desconocido'}`,
          sender: "bot",
          timestamp: new Date(),
          type: "system",
        }
      ])
    }
  }
  
  // Función para conectar al servidor WebSocket
  const connectWebSocket = (token: string) => {
    console.log('🔌 [WEBSOCKET] Iniciando conexión WebSocket...');
    try {
      if (socketRef.current) {
        console.log('🔄 [WEBSOCKET] Desconectando socket existente...');
        socketRef.current.disconnect();
      }
      
      console.log('🎟️ [WEBSOCKET] Token para autenticación (primeros 20 chars):', token.substring(0, 20) + '...');
      setSocketStatus("conectando");
      
      // Crear conexión Socket.IO con token de autenticación
      console.log('📡 [WEBSOCKET] Configurando conexión Socket.IO...');
      console.log('🌐 [WEBSOCKET] URL del servidor: wss://sophi-wss.sistemaoperaciones.com');
      console.log('🛤️ [WEBSOCKET] Path: /sophi-wss');
      console.log('⚙️ [WEBSOCKET] Configuración:', {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        forceNew: true,
        timeout: 10000
      });
      
      
      socketRef.current = io('wss://sophi-wss.sistemaoperaciones.com', {

        path: '/sophi-wss',
        transports: ['websocket'],
        auth: { token: token },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        forceNew: true,
        timeout: 10000
      });
      
      console.log('👂 [WEBSOCKET] Configurando event listeners...');
      
      // Eventos del socket
      socketRef.current.on('connect', () => {
        console.log('✅ [WEBSOCKET] ¡Conexión establecida exitosamente!');
        console.log('🆔 [WEBSOCKET] Socket ID:', socketRef.current?.id);
        setSocketStatus("conectado");
        addSystemMessage("Conexión WebSocket establecida");
        setMessages([
          {
            id: (Date.now() + 1).toString(),
            content: "¡Hola! Soy Sophi, tu asistente de chat. ¿En qué puedo ayudarte hoy?",
            sender: "bot",
            timestamp: new Date(),
          }
        ])
      });
      
      socketRef.current.on('disconnect', (reason) => {
        console.log('🔌 [WEBSOCKET] Desconectado del servidor');
        console.log('📋 [WEBSOCKET] Razón de desconexión:', reason);
        setSocketStatus("desconectado");
        addSystemMessage("WebSocket desconectado");
      });
      
      socketRef.current.on('error', (error) => {
        console.error('❌ [WEBSOCKET] Error de socket:', error);
        console.error('📍 [WEBSOCKET] Tipo de error:', typeof error);
        console.error('📄 [WEBSOCKET] Detalles del error:', error);
        setSocketStatus(`error: ${error}`);
        addSystemMessage(`Error de WebSocket: ${error}`);
      });
      
      socketRef.current.on('connect_error', (error) => {
        console.error('💥 [WEBSOCKET] Error de conexión:', error);
        console.error('📄 [WEBSOCKET] Mensaje completo:', error.message);
        console.error('📍 [WEBSOCKET] Tipo de error:', error.name);
        console.error('📋 [WEBSOCKET] Stack trace:', error.stack);
        setSocketStatus(`error de conexión: ${error.message}`);
        addSystemMessage(`Error de conexión WebSocket: ${error.message}`);
      });
      
      // Escuchar mensajes entrantes
      socketRef.current.on('message', (data) => {
        try {
          console.log('Datos recibidos sin procesar:', data.status);
          
          // Filtro para mensajes técnicos de varios formatos
          if (typeof data === 'string') {
            try {
              // Intentamos parsear para verificar la estructura
              const testObj = JSON.parse(data);
              console.log("testObj:", testObj)
              // CASO ESPECIAL: Manejar transcription_complete como mensaje del usuario
              if (testObj.status === 'transcription_complete') {
                console.log('transcrip:', testObj);
                
                // Añadir como mensaje del usuario
                setMessages(prevMessages => [...prevMessages, {
                  id: Date.now().toString(),
                  content: testObj.message.content,
                  sender: "user", // Importante: lo marcamos como mensaje del usuario
                  timestamp: new Date(),
                  type: "transcription" // Tipo específico para transcripciones
                }]);
                
                return; // Ya procesamos este mensaje
              }
              
              // Caso 1: Filtrar mensajes con status "received"
              if (testObj.status === 'received' && testObj.messageType) {
                // Estos son mensajes técnicos de confirmación de recepción
                console.log('Mensaje de confirmación "received" filtrado:', data);
                return; // No procesar este mensaje
              }
              // Caso 2: Filtrar mensajes con status "processing"
              if (testObj.status === 'processing' && testObj.messageType) {
                // Estos son mensajes técnicos de procesamiento
                console.log('Mensaje de procesamiento filtrado:', data);
                return; // No procesar este mensaje
              }
              // Caso 3: Filtrar mensajes de procesamiento de audio
              if (testObj.status === 'processing_audio' && testObj.messageType) {
                // Estos son mensajes técnicos de procesamiento de audio
                console.log('Mensaje de procesamiento de audio filtrado:', data);
                return; // No procesar este mensaje
              }
            } catch {
              // Si hay error al parsear, permitimos que el flujo continúe
            }
          }
          
          // Paso 1: Asegurarse de que tenemos un objeto (parsear si es string)
          const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
          
          // Verificar si es un mensaje de transcripción completada
          if (typeof parsedData === 'object' && 
              parsedData !== null && 
              parsedData.status === 'transcription_complete' && 
              parsedData.text) {
            
            console.log('Mensaje de transcripción completada detectado:', parsedData);
            
            // Añadir como mensaje del usuario en lugar del bot
            setMessages(prevMessages => [...prevMessages, {
              id: Date.now().toString(),
              content: parsedData.text,
              sender: "user", // Importante: lo marcamos como mensaje del usuario
              timestamp: new Date(),
              type: "transcription" // Opcional: podemos añadir un tipo específico
            }]);
            
            return; // Ya procesamos este mensaje, no continuar
          }
          
          // Paso 2: Detectar SOLO mensajes puramente técnicos (con formato exacto de los que vimos en el error)
          // Solo filtramos objetos JSON con exactamente la estructura que causa problemas
          const isRawSocketMessage = 
            typeof parsedData === 'object' && 
            // Detectar exactamente el formato de los mensajes técnicos que queríamos filtrar
            parsedData !== null &&
            parsedData.socketId && 
            parsedData.timestamp && 
            !parsedData.text && // No tiene contenido de texto explícito
            !parsedData.message && // No tiene un mensaje explícito
            typeof parsedData.content !== 'string'; // No tiene contenido legible
          
          // Solo filtramos estos mensajes técnicos muy específicos
          if (isRawSocketMessage) {
            console.log('Mensaje técnico de socket filtrado:', parsedData);
            return; // No mostrar este tipo de mensaje
          }
          
          // Detectar si es un mensaje de audio con campo audioData
          if (parsedData && typeof parsedData === 'object' && parsedData.audioData) {
            console.log('Mensaje de audio detectado:', parsedData);
            
            try {
              // Obtener el tipo MIME del audio (usando webm por defecto si no está disponible)
              const mimeType = parsedData.metadata?.mimeType || 'audio/webm';
              
              // Crear un Blob a partir de los datos base64
              const byteCharacters = atob(parsedData.audioData);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              const audioBlob = new Blob([byteArray], { type: mimeType });
              
              // Crear URL para reproducir el audio
              const audioURL = URL.createObjectURL(audioBlob);
              
              // Extraer el texto del mensaje si existe
              let textContent = "Audio";
              
              // Intentar extraer el contenido de estructuras JSON anidadas
              const tryParseJsonContent = (data: any) => {
                if (!data) return null;
                
                // Si es un string que parece JSON, intentar parsearlo
                if (typeof data === 'string' && (data.startsWith('{') || data.startsWith('['))) {
                  try {
                    const parsed = JSON.parse(data);
                    if (parsed.content) return parsed.content;
                    return null;
                  } catch {
                    return null;
                  }
                }
                
                // Si ya es un objeto, buscar el campo content
                if (typeof data === 'object' && data !== null && data.content) {
                  return data.content;
                }
                
                return null;
              };
              
              // Primero, buscar en el campo content directamente
              if (parsedData.content) {
                const extractedContent = tryParseJsonContent(parsedData.content);
                if (extractedContent) {
                  textContent = extractedContent;
                } else {
                  textContent = typeof parsedData.content === 'string' ? parsedData.content : JSON.stringify(parsedData.content);
                }
              } 
              // Luego en message
              else if (parsedData.message) {
                const extractedContent = tryParseJsonContent(parsedData.message);
                if (extractedContent) {
                  textContent = extractedContent;
                } else {
                  textContent = typeof parsedData.message === 'string' ? parsedData.message : JSON.stringify(parsedData.message);
                }
              } 
              // Finalmente en text
              else if (parsedData.text) {
                textContent = parsedData.text;
              }
              
              // Añadir mensaje de audio del bot con texto
              setMessages(prevMessages => [...prevMessages, {
                id: Date.now().toString(),
                content: textContent, // Contenido de texto del mensaje
                sender: "bot",
                timestamp: new Date(),
                type: "audio",
                audioUrl: audioURL
              }]);
              
              // Desactivar indicador de espera cuando se recibe una respuesta
              setIsWaitingResponse(false);
              
              // Ya hemos procesado este mensaje, así que retornamos
              return;
            } catch (error) {
              console.error('Error al procesar audio:', error);
              // Si hay error, continuamos con el procesamiento normal
            }
          }
          
          // Paso 3: Extraer el contenido del mensaje según la estructura recibida
          let messageContent = '';
          let graphUrls: string[] = [];
          
          if (typeof parsedData === 'string') {
            // Verificar si es un mensaje con formato numérico al inicio (como "42["message",...")
            if (parsedData.match(/^\d+\["message"/)) {
              try {
                // Extraer la parte JSON del mensaje
                const jsonStartIndex = parsedData.indexOf('["message","') + 11;
                const jsonEndIndex = parsedData.lastIndexOf('"]');
                if (jsonStartIndex > 0 && jsonEndIndex > jsonStartIndex) {
                  const jsonStr = parsedData.substring(jsonStartIndex, jsonEndIndex);
                  // Reemplazar escape de comillas dentro del JSON
                  const cleanJson = jsonStr.replace(/\\\"([^\\\"]*)\\\"/g, '"$1"');
                  const messageObj = JSON.parse(cleanJson);
                  
                  // Extraer contenido y gráficos si existen
                  if (messageObj.message && messageObj.message.content) {
                    messageContent = messageObj.message.content;
                  }
                  
                  // Extraer gráficos de quoteData si existen
                  if (messageObj.quoteData && messageObj.quoteData.graphs && Array.isArray(messageObj.quoteData.graphs)) {
                    graphUrls = messageObj.quoteData.graphs.map((graph: string) => 
                      `https://sophi-agent.sistemaoperaciones.com${graph}`
                    );
                  }
                }
              } catch (error) {
                console.error('Error al procesar mensaje con formato numérico:', error);
                messageContent = parsedData;
              }
            } else {
              // Si ya es una cadena de texto después de parsear
              messageContent = parsedData;
            }
          } else if (parsedData && typeof parsedData === 'object') {
            // Es un objeto, extraer el contenido según su estructura
            if (parsedData.message) {
              // Verificar si es un objeto con estructura compleja que incluye quoteData
              if (typeof parsedData.message === 'object' && parsedData.message.content) {
                messageContent = parsedData.message.content;
              } else {
                messageContent = typeof parsedData.message === 'string' ? parsedData.message : JSON.stringify(parsedData.message);
              }
              
              // Extraer gráficos si existen en quoteData
              if (parsedData.quoteData && parsedData.quoteData.graphs && Array.isArray(parsedData.quoteData.graphs)) {
                graphUrls = parsedData.quoteData.graphs.map((graph: string) => 
                  `https://sophi-agent.sistemaoperaciones.com${graph}`
                );
              }
            } else if (parsedData.content) {
              messageContent = typeof parsedData.content === 'string' ? parsedData.content : JSON.stringify(parsedData.content);
            } else if (parsedData.userMessage) {
              // Mensaje específico para el usuario
              messageContent = parsedData.userMessage;
            } else if (parsedData.text) {
              // Si tiene un campo text, usarlo directamente
              messageContent = parsedData.text;
            } else {
              // Para cualquier otro tipo de mensaje, intentamos extraer información útil
              // o simplemente lo convertimos a string como último recurso
              messageContent = JSON.stringify(parsedData);
            }
          } else {
            // Fallback para cualquier otro tipo de datos
            messageContent = String(parsedData);
          }
          
          // Solo filtramos mensajes que son claramente mensajes técnicos
          if (messageContent.startsWith('{"socketId":') && messageContent.includes('timestamp') && !messageContent.includes('text')) {
            console.log('Mensaje JSON técnico filtrado:', messageContent);
            return; // No mostrar el mensaje
          }
          
          console.log('Contenido extraído del mensaje que se mostrará:', messageContent);
          console.log('Gráficos encontrados:', graphUrls);
          
          // Paso 4: Añadir el mensaje procesado al chat si pasó todos los filtros
          if (graphUrls.length > 0) {
            // Si hay gráficos, usamos la función especial para mensajes con imágenes
            addBotMessageWithGraphs(messageContent, graphUrls);
          } else {
            addBotMessage(messageContent);
          }
          
          // Desactivar indicador de espera cuando se recibe una respuesta
          setIsWaitingResponse(false);
        } catch (error) {
          console.error('Error al procesar mensaje:', error);
        }
      });
      
      // Verificar estado después de un retraso
      setTimeout(() => {
        if (socketRef.current?.connected) {
          console.log('Socket está conectado después del timeout');
          setSocketStatus("conectado");
        } else {
          console.log('Socket NO está conectado después del timeout');
          setSocketStatus("problema al conectar");
          addSystemMessage("Problema al conectar con el servidor WebSocket");
        }
      }, 3000);
      
    } catch (error) {
      console.error('Error al configurar WebSocket:', error);
      setSocketStatus(`error: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      addSystemMessage(`Error al configurar WebSocket: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  // Helper para añadir mensajes del sistema
  const addSystemMessage = (content: string) => {
    setMessages(prevMessages => [...prevMessages, {
      id: Date.now().toString(),
      content,
      sender: "bot",
      timestamp: new Date(),
      type: "system",
    }]);
  };

  // Helper para añadir mensajes del bot
  const addBotMessage = (content: string) => {
    // Si el contenido parece ser un objeto JSON serializado, intenta extraer el campo 'content'
    let messageContent = content;
    
    try {
      // Verifica si el contenido parece ser un JSON string
      if (content.startsWith('{') && content.includes('content')) {
        const parsedContent = JSON.parse(content);
        if (parsedContent.content) {
          messageContent = parsedContent.content;
        }
      }
    } catch {
      // Si hay error al intentar parsear, usamos el contenido original
      console.log('No es un JSON válido, usando texto original');
    }
    
    setMessages(prevMessages => [...prevMessages, {
      id: Date.now().toString(),
      content: messageContent,
      sender: "bot",
      timestamp: new Date()
    }]);
  };
  
  // Helper para añadir mensajes del bot con gráficos/imágenes
  const addBotMessageWithGraphs = (content: string, graphs: string[]) => {
    let messageContent = content;
    
    try {
      // Verifica si el contenido parece ser un JSON string
      if (content.startsWith('{') && content.includes('content')) {
        const parsedContent = JSON.parse(content);
        if (parsedContent.content) {
          messageContent = parsedContent.content;
        }
      }
    } catch {
      console.log('No es un JSON válido, usando texto original');
    }
    
    setMessages(prevMessages => [...prevMessages, {
      id: Date.now().toString(),
      content: messageContent,
      sender: "bot",
      timestamp: new Date(),
      type: "image",
      graphs: graphs
    }]);
  };

  // Función para cerrar el chat
  const closeChat = () => {
    // Desconectar socket
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    setIsConnected(false)
    setMessages([])
    setShowSettingsModal(false)
    setAuthToken(null)
    setUserInfo(null)
    localStorage.removeItem('authToken')
    localStorage.removeItem('userInfo')
    setSocketStatus("desconectado")
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = () => {
    if (inputMessage.trim() !== "") {
      // Agregar mensaje del usuario
      const newMessage: Message = {
        id: Date.now().toString(),
        content: inputMessage,
        sender: "user",
        timestamp: new Date(),
      }
      
      setMessages([...messages, newMessage])
      
      // Activar indicador de espera
      setIsWaitingResponse(true);
      
      // Enviar mensaje al servidor WebSocket si está conectado
      if (socketRef.current?.connected) {
        socketRef.current.emit('message', {
          message: inputMessage,
          timestamp: new Date().toISOString()
        });
      } else {
        // Si no hay conexión, mostrar mensaje de error
        addSystemMessage("No se pudo enviar el mensaje: WebSocket desconectado");
        setIsWaitingResponse(false); // Desactivar indicador en caso de error
      }
      
      setInputMessage("")
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const toggleRecording = async () => {
    // Si ya estamos grabando, detener la grabación
    if (isRecording) {
      stopRecording();
      return;
    }
    
    try {
      // Solicitar permisos de micrófono
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Configurar MediaRecorder con opciones óptimas
      const options = { mimeType: 'audio/webm' };
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      // Capturar datos de audio cada 250ms para mejor calidad
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log('Chunk de audio recibido, tamaño:', event.data.size);
        }
      };
      
      // Cuando la grabación se detiene
      mediaRecorder.onstop = () => {
        // Crear blob de audio con los chunks recolectados
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        sendAudioMessage(audioBlob);
        
        // Liberar el stream
        stream.getTracks().forEach(track => track.stop());
      };
      
      // Iniciar grabación con intervalos de datos cada 250ms
      mediaRecorder.start(250);
      setIsRecording(true);
      
      // Configurar un tiempo máximo de grabación (30 segundos)
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          stopRecording();
          console.log('Grabación detenida automáticamente (límite de tiempo)');
        }
      }, 30000);
      
      console.log('Grabación de audio iniciada');
    } catch (error) {
      console.error('Error al iniciar grabación:', error);
      addSystemMessage(`Error al acceder al micrófono: ${error instanceof Error ? error.message : 'Permiso denegado'}`);
    }
  }

  // Función para detener la grabación en curso
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      try {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        console.log('Grabación de audio detenida');
        addSystemMessage("Grabación de audio finalizada");
      } catch (error) {
        console.error('Error al detener grabación:', error);
        setIsRecording(false);
      }
    }
  }

  // Función para enviar mensaje de audio al servidor
  const sendAudioMessage = async (audioBlob: Blob) => {
    try {
      // Verificar que el audio tenga contenido
      if (audioBlob.size === 0) {
        addSystemMessage("No se detectó audio en la grabación");
        return;
      }
      
      // Mostrar mensaje de carga mientras se procesa el audio
      const loadingMessageId = Date.now().toString();
      setMessages(prevMessages => [...prevMessages, {
        id: loadingMessageId,
        content: "Enviando mensaje de audio...",
        sender: "bot",
        timestamp: new Date(),
        type: "system"
      }]);
      
      // Comprobar si el dispositivo puede reproducir el audio (para depuración)
      const audioURL = URL.createObjectURL(audioBlob);
      console.log('Audio grabado disponible en:', audioURL);
      
      // Convertir el audio a base64 para enviar por WebSocket
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = () => {
        // Extraer solo la parte de Base64 (sin el prefijo data:audio/webm;base64,)
        const base64Data = (reader.result as string).split(',')[1];
        
        // Enviar audio por WebSocket
        if (socketRef.current?.connected) {
          // Mensaje visual para el usuario con reproductor de audio
          setMessages(prevMessages => {
            const newMessages = prevMessages.filter(msg => msg.id !== loadingMessageId);
            return [...newMessages, {
              id: Date.now().toString(),
              content: "Audio", // Etiqueta simple ya que el audio será visible
              sender: "user",
              timestamp: new Date(),
              type: "audio", // Marcar como mensaje de audio
              audioUrl: audioURL // Guardar la URL del audio para reproducción
            }];
          });
          
          setIsWaitingResponse(true);
          
          // Enviar el audio al servidor con el nuevo formato
          const message = {
            type: 'audio',
            content: base64Data,
            metadata: {
              mimeType: audioBlob.type,
              size: audioBlob.size
            },
            room: 'sophi-wss'
          };
          
          socketRef.current.emit('message', JSON.stringify(message));
          console.log('Audio enviado por WebSocket');
        } else {
          // Mostrar error si no hay conexión
          setMessages(prevMessages => {
            const newMessages = prevMessages.filter(msg => msg.id !== loadingMessageId);
            return [...newMessages];
          });
          addSystemMessage("No se pudo enviar el audio: WebSocket desconectado");
        }
      };
    } catch (error) {
      console.error('Error al procesar audio:', error);
      addSystemMessage(`Error al enviar audio: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  // Función para descargar imagen
  const downloadImage = (imageUrl: string, fileName: string) => {
    fetch(imageUrl)
      .then(response => response.blob())
      .then(blob => {
        // Crear un objeto URL para el blob
        const url = window.URL.createObjectURL(blob);
        
        // Crear un elemento <a> temporal
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        
        // Añadir el enlace al documento y simular clic
        document.body.appendChild(link);
        link.click();
        
        // Limpiar y eliminar el enlace
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      })
      .catch(error => {
        console.error('Error al descargar la imagen:', error);
      });
  }

  return (
    <div className="w-screen h-[100dvh] overflow-hidden">
        {/* Modal de Login */}
        {showLoginModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-20">
            <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md mx-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Iniciar Sesión</h2>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setShowLoginModal(false)}
                  className="h-8 w-8"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              
              {loginError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4">
                  {loginError}
                </div>
              )}
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="username" className="text-sm font-medium">Usuario</label>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input 
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="pl-10"
                      placeholder="Nombre de usuario"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium">Contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input 
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      placeholder="Contraseña"
                    />
                  </div>
                </div>
                
                <Button 
                  onClick={handleLogin}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                >
                  Iniciar Sesión
                </Button>
              </div>
            </div>
          </div>
        )}
        
        <div className="flex flex-col w-screen h-screen bg-gradient-to-br from-slate-50 to-slate-100">
          <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Avatar className="h-10 w-10">
                  <AvatarImage src="/placeholder.svg?height=40&width=40" />
                  <AvatarFallback className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">SC</AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Sophi Chat</h1>
                  <div className="flex items-center space-x-2">
                    {isWaitingResponse ? (
                      <div className="flex items-center space-x-2 py-1 px-2 bg-blue-50 dark:bg-blue-900/20 rounded-full animate-pulse">
                        <Loader2 className="h-3 w-3 animate-spin text-blue-500 dark:text-blue-400" />
                        <span className="text-sm text-blue-600 dark:text-blue-400">Sophi está escribiendo...</span>
                      </div>
                    ) : (
                      <>
                        <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                          {isConnected ? "Conectado" : "Desconectado"}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2 relative">
                <Button 
                  variant="ghost" 
                  onClick={() => setShowSettingsModal(!showSettingsModal)}
                >
                  <Settings className="h-5 w-5" />
                </Button>
                
                {showSettingsModal && (
                  <div className="absolute right-0 top-full mt-2 bg-white shadow-lg rounded-md p-2 z-10 w-48 border border-slate-200">
                    <div className="flex flex-col gap-2">
                      <Button 
                        variant="outline" 
                        className="flex justify-start items-center gap-2" 
                        onClick={openLoginModal}
                        disabled={isConnected}
                      >
                        <Power className="h-4 w-4 text-green-500" />
                        <span>Iniciar chat</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        className="flex justify-start items-center gap-2" 
                        onClick={closeChat}
                        disabled={!isConnected}
                      >
                        <X className="h-4 w-4 text-red-500" />
                        <span>Cerrar chat</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Eliminamos el indicador de espera flotante ya que ahora está en la barra de navegación */}
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 w-full">
            
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`flex items-start space-x-3 max-w-[80%] ${message.sender === "user" ? "flex-row-reverse space-x-reverse" : ""}`}
                >
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    {message.sender === "user" ? (
                      <AvatarFallback className="bg-blue-500 text-white">
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    ) : (
                      <AvatarFallback className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    )}
                  </Avatar>

                  <div className={`flex flex-col ${message.sender === "user" ? "items-end" : "items-start"}`}>
                    <Card
                      className={`p-3 ${
                        message.type === "system"
                          ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                          : message.sender === "user" || message.type === "transcription"
                            ? "bg-blue-500 text-white border-blue-500"
                            : "bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600"
                      }`}
                    >
                      {message.type === "system" && (
                        <Badge
                          variant="secondary"
                          className="mb-2 bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100"
                        >
                          Sistema
                        </Badge>
                      )}
                      {message.type === "transcription" && (
                        <Badge
                          variant="secondary"
                          className="mb-2 bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100"
                        >
                          Transcripción
                        </Badge>
                      )}
                      {message.type === "audio" ? (
                        <div className="flex flex-col gap-2">
                          <p
                            className={`text-sm ${
                              message.sender === "user" ? "text-white" : "text-slate-900 dark:text-slate-100"
                            }`}
                          >
                            {message.content}
                          </p>
                          <div className="flex flex-col gap-1">
                            <p
                              className={`text-xs ${
                                message.sender === "user" ? "text-white" : "text-slate-700 dark:text-slate-300"
                              }`}
                            >
                              Mensaje de audio:
                            </p>
                            <audio 
                              controls 
                              src={message.audioUrl} 
                              className="max-w-[200px] h-8"
                            />
                          </div>
                        </div>
                      ) : message.type === "image" ? (
                        <div className="flex flex-col gap-4">
                          <p
                            className={`text-sm ${
                              message.sender === "user" ? "text-white" : "text-slate-900 dark:text-slate-100"
                            }`}
                          >
                            {message.content}
                          </p>
                          <div className="flex flex-col gap-3">
                            {message.graphs?.map((graphUrl, index) => (
                              <div key={index} className="flex flex-col gap-2">
                                <div className="relative group">
                                  <img 
                                    src={graphUrl} 
                                    alt={`Gráfico ${index + 1}`} 
                                    className="max-w-full rounded-md shadow-sm" 
                                    style={{ maxHeight: '300px' }}
                                    onError={(e) => {
                                      console.error('Error al cargar imagen:', graphUrl);
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                  <div className="absolute top-2 right-2 flex gap-2 opacity-70 hover:opacity-100">
                                    <Button 
                                      size="icon"
                                      variant="secondary"
                                      className="h-8 w-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-sm hover:bg-white dark:hover:bg-gray-800 text-blue-600 dark:text-blue-400"
                                      title="Abrir en nueva pestaña"
                                      onClick={() => window.open(graphUrl, '_blank')}
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      size="icon"
                                      variant="secondary"
                                      className="h-8 w-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-sm hover:bg-white dark:hover:bg-gray-800 text-green-600 dark:text-green-400"
                                      title="Descargar imagen"
                                      onClick={() => downloadImage(graphUrl, `grafico-${index+1}.png`)}
                                    >
                                      <Download className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                                <div className="flex justify-center">
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200 hover:border-blue-300 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 dark:text-blue-400 dark:border-blue-900/50 flex items-center gap-2"
                                    onClick={() => window.open(graphUrl, '_blank', 'width=800,height=600,menubar=no,toolbar=no,location=no,status=no')}
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                    Visualizar imagen
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p
                          className={`text-sm ${
                            message.type === "system"
                              ? "text-green-800 dark:text-green-200"
                              : message.sender === "user"
                                ? "text-white"
                                : "text-slate-900 dark:text-slate-100"
                          }`}
                        >
                          {message.content}
                        </p>
                      )}
                    </Card>
                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">{formatTime(message.timestamp)}</span>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <Separator />
          {
            authToken ? 
            <div className="bg-white border-t border-slate-200 dark:border-slate-700 px-4 py-4 w-full">
            <div className="flex items-center space-x-3 w-full">
                <Input
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Escribe un mensaje..."
                  className="pr-12 bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent flex-1"
                />
              <Button
                onClick={toggleRecording}
                className="bg-gray-500 hover:bg-gray-600 text-white px-6"
              >
                <Mic className="h-4 w-4" />
              </Button>
              <Button
                onClick={handleSendMessage}
                disabled={inputMessage.trim() === ""}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>

            {isRecording && (
              <div className="flex items-center justify-center mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-sm text-red-600 dark:text-red-400">Grabando audio...</span>
                </div>
              </div>
            )}
          </div> : null
          }
          
        </div>
    </div>
  )
}
