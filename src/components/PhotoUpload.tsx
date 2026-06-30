import { useRef, useState } from 'react';
import Icon from '@/components/ui/icon';
import { uploadPhoto } from '@/lib/api';
import { toast } from 'sonner';

interface Props {
  token: string;
  url: string | null;
  target?: 'master' | 'service';
  onUploaded: (url: string | null) => void;
  size?: 'sm' | 'md' | 'lg';
  shape?: 'square' | 'round';
  label?: string;
}

export default function PhotoUpload({
  token, url, target = 'master', onUploaded,
  size = 'md', shape = 'square', label,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const sizeClass = {
    sm: 'h-16 w-16',
    md: 'h-24 w-24',
    lg: 'h-32 w-32',
  }[size];

  const shapeClass = shape === 'round' ? 'rounded-full' : 'rounded-2xl';

  const compress = (file: File): Promise<File> =>
    new Promise(resolve => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const MAX = 1200;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        canvas.toBlob(blob => {
          resolve(blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file);
        }, 'image/jpeg', 0.82);
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
      img.src = objectUrl;
    });

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return toast.error('Выберите изображение');
    if (file.size > 20 * 1024 * 1024) return toast.error('Файл слишком большой (макс. 20 МБ)');
    setUploading(true);
    const compressed = await compress(file);
    const resultUrl = await uploadPhoto(token, compressed, target);
    setUploading(false);
    if (resultUrl) {
      onUploaded(resultUrl);
    } else {
      toast.error('Ошибка загрузки фото');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {label && <p className="text-xs text-muted-foreground">{label}</p>}
      <div className="relative group">
        {/* Превью или плейсхолдер */}
        <div
          className={`${sizeClass} ${shapeClass} overflow-hidden border-2 border-dashed border-border bg-secondary/50 transition-colors group-hover:border-primary cursor-pointer`}
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
        >
          {uploading ? (
            <div className="flex h-full w-full items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : url ? (
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
              <Icon name="ImagePlus" size={size === 'sm' ? 16 : 22} />
              {size !== 'sm' && <span className="text-[10px]">Загрузить</span>}
            </div>
          )}
        </div>

        {/* Кнопки действий поверх фото */}
        {url && !uploading && (
          <div className="absolute -right-1 -top-1 flex flex-col gap-1">
            <button
              onClick={() => inputRef.current?.click()}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow"
              title="Заменить"
            >
              <Icon name="Pencil" size={11} />
            </button>
            <button
              onClick={() => onUploaded(null)}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow"
              title="Удалить"
            >
              <Icon name="X" size={11} />
            </button>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}