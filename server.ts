import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '15mb' }));

// Lazy initializer for Google GenAI client (server-side only)
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Endpoint para análisis inteligente de partes médicos / bajas mediante Gemini.
 * Extrae de forma segura:
 * - fechaInicio: YYYY-MM-DD
 * - fechaFin: YYYY-MM-DD
 * - diasDuracion: número de días
 * - estado: 'CONFIRMADO' | 'REVISION_MANUAL'
 * 
 * REGLA ESTRICTA: La IA NO debe inventar una duración.
 * Si no puede determinarla con total seguridad a partir del documento,
 * debe clasificarlo obligatoriamente como REVISION_MANUAL.
 */
app.post('/api/analizar-parte-medico', async (req, res) => {
  try {
    const { fileBase64, mimeType, textoObservaciones } = req.body;

    if (!fileBase64 && !textoObservaciones) {
      return res.status(400).json({
        success: false,
        error: 'Debe adjuntar un documento (PDF/imagen) o un texto explicativo del parte médico.',
      });
    }

    const ai = getGenAI();

    const parts: any[] = [];

    if (fileBase64 && mimeType) {
      parts.push({
        inlineData: {
          data: fileBase64.replace(/^data:[^;]+;base64,/, ''),
          mimeType: mimeType || 'image/jpeg',
        },
      });
    }

    const promptText = `
Eres un asistente médico administrativo oficial militar para la lectura e interpretación de partes de baja médica e indisposiciones.
Analiza el documento médico adjunto y las observaciones facilitadas: "${textoObservaciones || 'Sin observaciones'}".

REGLAS CRÍTICAS DE EXTRACCIÓN:
1. Extrae la fecha de inicio de la baja/indisposición (formato YYYY-MM-DD). Si no es explícita, usa la fecha de emisión del parte.
2. Determina la fecha de fin o duración prevista (días).
3. REGLA ESTRICTA DE PRECISIÓN: Si el parte médico no indica explícitamente la duración o fecha de alta estimada, o si existe cualquier duda o ambigüedad, NO INVENTES NINGUNA DURACIÓN. En ese caso, marca estado="REVISION_MANUAL" y diasDuracion=null / fechaFin=null.
4. Si la duración está clara (ej: "baja por 4 días", "baja del 05/10/2026 al 12/10/2026", "reposo 48h / 2 días"), calcula las fechas con exactitud y marca estado="CONFIRMADO".
5. Extrae un breve resumen no confidencial (diagnóstico resumido o motivo funcional, ej: "Proceso gripal agudo", "Traumatismo tobillo", "Indisposición gastrointestinal").
`;

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fechaInicio: {
              type: Type.STRING,
              description: 'Fecha de inicio de la baja en formato YYYY-MM-DD o null si no se detecta.',
            },
            fechaFin: {
              type: Type.STRING,
              description: 'Fecha estimada de fin de la baja en formato YYYY-MM-DD o null si no se especifica.',
            },
            diasDuracion: {
              type: Type.INTEGER,
              description: 'Número exacto de días de duración si consta explícitamente en el documento.',
            },
            estado: {
              type: Type.STRING,
              description: 'Debe ser CONFIRMADO si las fechas/duración son exactas y explícitas, o REVISION_MANUAL si hay ambigüedad o falta fecha de fin.',
            },
            motivoRevision: {
              type: Type.STRING,
              description: 'Explicación del motivo en caso de requerir revisión manual por el mando.',
            },
            resumenDiagnostico: {
              type: Type.STRING,
              description: 'Resumen conciso y profesional del tipo de baja.',
            },
            confianza: {
              type: Type.STRING,
              description: 'Nivel de confianza: ALTA, MEDIA o BAJA.',
            },
          },
          required: ['estado', 'resumenDiagnostico'],
        },
      },
    });

    const parsedJson = JSON.parse(response.text?.trim() || '{}');

    return res.json({
      success: true,
      data: parsedJson,
    });
  } catch (error: any) {
    console.error('Error en análisis de parte médico con Gemini:', error);
    // Fallback seguro sin fallar la UI
    return res.json({
      success: true,
      data: {
        estado: 'REVISION_MANUAL',
        motivoRevision: 'El servicio de IA no pudo procesar automáticamente el documento. Requiere comprobación manual.',
        resumenDiagnostico: 'Parte médico presentado para comprobación administrativa.',
        confianza: 'BAJA',
      },
    });
  }
});

// Setup Vite or Static File Serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor unificado activo en http://0.0.0.0:${PORT}`);
  });
}

startServer();
