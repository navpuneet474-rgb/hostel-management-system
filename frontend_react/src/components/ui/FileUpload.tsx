import React, { useRef, useState } from 'react';
import { cn } from '../../utils/cn';
import { generateId, focusVisible } from '../../utils/accessibility';

export interface FileUploadProps {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // in bytes
  maxFiles?: number;
  onFilesChange?: (files: File[]) => void;
  className?: string;
  id?: string;
}

const FileUpload = React.forwardRef<HTMLInputElement, FileUploadProps>(
  ({
    label,
    error,
    helperText,
    required = false,
    accept = "image/*,.pdf,.doc,.docx",
    multiple = false,
    maxSize = 5 * 1024 * 1024, // 5MB default
    maxFiles = 3,
    onFilesChange,
    className,
    id,
    ...props
  }, ref) => {
    const inputId = id || generateId('file-upload');
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText ? `${inputId}-helper` : undefined;
    const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [dragActive, setDragActive] = useState(false);
    const [uploadError, setUploadError] = useState<string>('');

    const validateFiles = (files: FileList | File[]): { valid: File[], errors: string[] } => {
      const fileArray = Array.from(files);
      const errors: string[] = [];
      const valid: File[] = [];

      if (fileArray.length > maxFiles) {
        errors.push(`Maximum ${maxFiles} files allowed`);
        return { valid: [], errors };
      }

      fileArray.forEach((file, index) => {
        if (file.size > maxSize) {
          errors.push(`File "${file.name}" is too large. Maximum size is ${formatFileSize(maxSize)}`);
        } else {
          valid.push(file);
        }
      });

      return { valid, errors };
    };

    const formatFileSize = (bytes: number): string => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const handleFileChange = (files: FileList | null) => {
      if (!files) return;

      const { valid, errors } = validateFiles(files);
      
      if (errors.length > 0) {
        setUploadError(errors.join(', '));
        return;
      }

      setUploadError('');
      setSelectedFiles(valid);
      onFilesChange?.(valid);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFileChange(e.target.files);
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      
      const files = e.dataTransfer.files;
      handleFileChange(files);
    };

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
    };

    const removeFile = (index: number) => {
      const newFiles = selectedFiles.filter((_, i) => i !== index);
      setSelectedFiles(newFiles);
      onFilesChange?.(newFiles);
      
      // Clear the input value to allow re-selecting the same file
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

    const openFileDialog = () => {
      fileInputRef.current?.click();
    };

    const displayError = error || uploadError;

    return (
      <div className="space-y-2">
        {label && (
          <label 
            htmlFor={inputId}
            className={cn(
              'block text-sm font-medium text-gray-700',
              required && "after:content-['*'] after:ml-0.5 after:text-red-500"
            )}
          >
            {label}
            {required && (
              <span className="sr-only"> (required)</span>
            )}
          </label>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          id={inputId}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          className="sr-only"
          aria-describedby={describedBy}
          aria-required={required}
          {...props}
        />

        {/* Drop zone */}
        <div
          className={cn(
            'relative border-2 border-dashed rounded-lg p-6 transition-colors duration-200',
            'hover:border-brand-400 hover:bg-brand-50',
            focusVisible,
            dragActive 
              ? 'border-brand-500 bg-brand-50' 
              : displayError
                ? 'border-red-300 bg-red-50'
                : 'border-gray-300 bg-gray-50',
            className
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="text-center">
            <svg
              className={cn(
                'mx-auto h-12 w-12 mb-4',
                displayError ? 'text-red-400' : 'text-gray-400'
              )}
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
              aria-hidden="true"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            
            <div className="space-y-2">
              <button
                type="button"
                onClick={openFileDialog}
                className={cn(
                  'text-sm font-medium text-brand-600 hover:text-brand-500',
                  'focus:outline-none focus:underline',
                  displayError && 'text-red-600 hover:text-red-500'
                )}
              >
                Click to upload
              </button>
              <p className="text-sm text-gray-500">
                or drag and drop files here
              </p>
              <p className="text-xs text-gray-400">
                {accept.includes('image') && 'Images, '}
                {accept.includes('.pdf') && 'PDF, '}
                {accept.includes('.doc') && 'Word documents '}
                up to {formatFileSize(maxSize)}
                {multiple && ` (max ${maxFiles} files)`}
              </p>
            </div>
          </div>
        </div>

        {/* Selected files list */}
        {selectedFiles.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">
              Selected files ({selectedFiles.length}):
            </p>
            <div className="space-y-1">
              {selectedFiles.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
                >
                  <div className="flex items-center space-x-2 min-w-0 flex-1">
                    <svg
                      className="h-4 w-4 text-gray-400 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900 truncate">{file.name}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="ml-2 p-1 text-gray-400 hover:text-red-500 focus:outline-none focus:text-red-500"
                    aria-label={`Remove ${file.name}`}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error message */}
        {displayError && (
          <p 
            id={errorId}
            className="text-sm text-red-600 flex items-start space-x-1"
            role="alert"
            aria-live="polite"
          >
            <svg 
              className="h-4 w-4 mt-0.5 flex-shrink-0" 
              viewBox="0 0 20 20" 
              fill="currentColor"
              aria-hidden="true"
            >
              <path 
                fillRule="evenodd" 
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" 
                clipRule="evenodd" 
              />
            </svg>
            <span>{displayError}</span>
          </p>
        )}

        {/* Helper text */}
        {helperText && !displayError && (
          <p 
            id={helperId}
            className="text-sm text-gray-500"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

FileUpload.displayName = 'FileUpload';

export { FileUpload };