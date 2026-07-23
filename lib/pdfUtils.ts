import * as pdfjsLib from 'pdfjs-dist';

// Use standard worker path from cdnjs to avoid Vite build issues with worker loaders
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export const convertPdfToImage = async (file: File): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
      const pdf = await loadingTask.promise;
      
      // Get first page
      const page = await pdf.getPage(1);
      
      // Render to canvas
      const scale = 2.0; // Higher scale for better resolution
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      const renderContext = {
        canvasContext: context,
          viewport: viewport,
          canvas: canvas
      };
      
      await page.render(renderContext).promise;
      
      // Convert to base64 image
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      resolve(dataUrl);
    } catch (error) {
      console.error('Error converting PDF to image:', error);
      reject(error);
    }
  });
};

export const convertPdfFileToImageFile = async (file: File): Promise<File> => {
  const dataUrl = await convertPdfToImage(file);
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], file.name.replace('.pdf', '.jpg'), { type: 'image/jpeg', lastModified: Date.now() });
};
