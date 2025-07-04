import type React from "react"

import { useState, useRef, useEffect } from "react"
import { io, Socket } from "socket.io-client"
import { Send, Settings, User, Bot, Mic, X, Power, Lock, AtSign } from "lucide-react"
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
  type?: "text" | "system"
}

export default function ChatInterface() {
  // Estado para mensajes vacío inicialmente
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [socketStatus, setSocketStatus] = useState<string>("desconectado")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const socketRef = useRef<Socket | null>(null)
  console.log("socketStatus", socketStatus)
  // Función para mostrar el modal de login
  const openLoginModal = () => {
    setShowSettingsModal(false)
    setShowLoginModal(true)
    setLoginError(null)
  }

  // Función para autenticar y luego iniciar el chat
  const handleLogin = async () => {
    try {
      setLoginError(null)
      
      if (!username || !password) {
        setLoginError('Por favor ingresa usuario y contraseña')
        return
      }
      
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
      const response = await fetch('https://sophi-auth.sistemaoperaciones.com/api/users/token/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentials)
      });
      
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("data", data)
      if (data && data.access) {
        const token = data.access;
        setAuthToken(token)
        setIsConnected(true)
        
        // Conectar al WebSocket después de autenticar
        connectWebSocket(token);
        
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
      } else {
        throw new Error('No se recibió un token válido');
      }
    } catch (error) {
      console.error('Error al obtener token:', error);
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
    try {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      console.log("token", token)
      setSocketStatus("conectando");
      
      // Crear conexión Socket.IO con token de autenticación
      console.log('Iniciando conexión a Socket.IO...');
      
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
      
      // Eventos del socket
      socketRef.current.on('connect', () => {
        console.log('¡Evento connect recibido!', socketRef.current?.id);
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
      
      socketRef.current.on('disconnect', () => {
        setSocketStatus("desconectado");
        addSystemMessage("WebSocket desconectado");
      });
      
      socketRef.current.on('error', (error) => {
        console.error('Error de socket:', error);
        setSocketStatus(`error: ${error}`);
        addSystemMessage(`Error de WebSocket: ${error}`);
      });
      
      socketRef.current.on('connect_error', (error) => {
        console.error('Error de conexión:', error);
        console.log('Mensaje completo:', error.message);
        setSocketStatus(`error de conexión: ${error.message}`);
        addSystemMessage(`Error de conexión WebSocket: ${error.message}`);
      });
      
      // Escuchar mensajes entrantes
      socketRef.current.on('message', (data) => {
        try {
          console.log('Datos recibidos sin procesar:', data);
          
          // Filtro para mensajes técnicos de varios formatos
          if (typeof data === 'string') {
            try {
              // Intentamos parsear para verificar la estructura
              const testObj = JSON.parse(data);
              
              // Caso 2: Filtrar mensajes con status "received"
              if (testObj.status === 'received' && testObj.messageType) {
                // Estos son mensajes técnicos de confirmación de recepción
                console.log('Mensaje de confirmación "received" filtrado:', data);
                return; // No procesar este mensaje
              }
            } catch (e) {
              // Si hay error al parsear, permitimos que el flujo continúe
            }
          }
          
          // Paso 1: Asegurarse de que tenemos un objeto (parsear si es string)
          const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
          
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
          
          // Paso 3: Extraer el contenido del mensaje según la estructura recibida
          let messageContent = '';
          
          if (typeof parsedData === 'string') {
            // Si ya es una cadena de texto después de parsear
            messageContent = parsedData;
          } else if (parsedData && typeof parsedData === 'object') {
            // Es un objeto, extraer el contenido según su estructura
            if (parsedData.message) {
              messageContent = typeof parsedData.message === 'string' ? parsedData.message : JSON.stringify(parsedData.message);
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
          // Paso 4: Añadir el mensaje procesado al chat si pasó todos los filtros
          addBotMessage(messageContent);
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
      
      // Enviar mensaje al servidor WebSocket si está conectado
      if (socketRef.current?.connected) {
        socketRef.current.emit('message', {
          message: inputMessage,
          timestamp: new Date().toISOString()
        });
      } else {
        // Si no hay conexión, mostrar mensaje de error
        addSystemMessage("No se pudo enviar el mensaje: WebSocket desconectado");
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

  const toggleRecording = () => {
    setIsRecording(!isRecording)
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="w-screen h-screen overflow-hidden">
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
                    <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {isConnected ? "Conectado" : "Desconectado"}
                    </span>
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
                          : message.sender === "user"
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
