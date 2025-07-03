import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Send, Mic, MicOff, Settings, User, Bot, MoreVertical } from "lucide-react"
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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content: "Token obtenido exitosamente",
      sender: "bot",
      timestamp: new Date(),
      type: "system",
    },
    {
      id: "2",
      content: "¡Hola! Soy Sophi, tu asistente de chat. ¿En qué puedo ayudarte hoy?",
      sender: "bot",
      timestamp: new Date(),
    },
  ])
  const [inputMessage, setInputMessage] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTimeout(() => {
      setIsConnected(true)
    }, 5000);
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = () => {
    if (inputMessage.trim() === "") return

    const newMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      sender: "user",
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, newMessage])
    setInputMessage("")

    // Simulate bot response
    setTimeout(() => {
      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: "Gracias por tu mensaje. Estoy procesando tu solicitud...",
        sender: "bot",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, botResponse])
    }, 1000)
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
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 shadow-sm">
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
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
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

      {/* Input Area */}
      <div className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 px-4 py-4">
        <div className="flex items-center space-x-3">
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Escribe un mensaje..."
              className="pr-12 bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8"
              onClick={toggleRecording}
            >
              {isRecording ? <MicOff className="h-4 w-4 text-red-500" /> : <Mic className="h-4 w-4 text-slate-500" />}
            </Button>
          </div>

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
      </div>
    </div>
  )
}
