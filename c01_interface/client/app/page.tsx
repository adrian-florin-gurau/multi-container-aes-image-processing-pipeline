'use client';

import { useState, useMemo, useEffect } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001');

const AES_MODES = ['ECB', 'CBC', 'CTR', 'CFB', 'OFB', 'GCM'];
const VALID_KEY_SIZES = [16, 24, 32];

export default function AESPipelineClient() {
  const [file, setFile] = useState<File | null>(null);
  const [key, setKey] = useState('1234567890123456');
  const [iv, setIv] = useState('initialvector123');
  const [mode, setMode] = useState('ECB');
  const [action, setAction] = useState<'ENCRYPT' | 'DECRYPT'>('ENCRYPT');
  const [status, setStatus] = useState({ type: 'idle', msg: '' });

  // Track the active job ID for the download trigger
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  const isIvRequired = useMemo(() => mode !== 'ECB', [mode]);
  const isKeySizeValid = useMemo(() => VALID_KEY_SIZES.includes(key.length), [key]);

  useEffect(() => {
    const handleJobFinished = (data: { jobId: string }) => {
      // We check against the jobId from the event
      if (currentJobId && data.jobId === currentJobId) {
        console.log("Job ready! Triggering download...");
        setStatus({ type: 'success', msg: `JOB ${data.jobId} COMPLETE. Downloading...` });
        
        // Creating a temporary link to force the download
        const downloadUrl = `http://localhost:8081/image/${data.jobId}`;
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.setAttribute('download', `processed_${data.jobId}.bmp`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    };

    socket.on('jobFinished', handleJobFinished);
    return () => { socket.off('jobFinished', handleJobFinished); };
  }, [currentJobId]); // Re-binds when currentJobId changes

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();

    // 1. Image Presence & Format Validation
    if (!file) {
      return setStatus({ type: 'error', msg: 'ERROR: No file selected.' });
    }

    if (!file.name.toLowerCase().endsWith('.bmp')) {
      return setStatus({ 
        type: 'error', 
        msg: 'ERROR: Only .bmp files are supported for HSM direct-mapping.' 
      });
    }

    // 2. Key Size Validation
    if (!isKeySizeValid) {
      return setStatus({ 
        type: 'error', 
        msg: `ERROR: Invalid Key size (${key.length}). Must be 16, 24, or 32 chars.` 
      });
    }

    // 3. IV Size Validation
    if (isIvRequired && iv.length !== 16) {
      return setStatus({ 
        type: 'error', 
        msg: `ERROR: IV must be exactly 16 characters (Current: ${iv.length}).` 
      });
    }

    setStatus({ type: 'loading', msg: `Submitting ${action} request to HSM...` });

    const formData = new FormData();
    formData.append('image', file);
    formData.append('key', key);
    formData.append('mode', mode);
    formData.append('action', action);
    if (isIvRequired) formData.append('iv', iv);

    try {
      const response = await fetch('http://localhost:3001/process', { method: 'POST', body: formData });
      if (!response.ok) throw new Error();
      const result = await response.json();
      setCurrentJobId(result.jobId);
      setStatus({ type: 'success', msg: `${action} Task Accepted. ID: ${result.jobId}` });
    } catch (err) {
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        setStatus({ type: 'error', msg: 'CRITICAL: Cannot connect to HSM Gateway (Port 3001). Is the container down?' });
      } else {
        setStatus({ type: 'error', msg: 'HSM Gateway unreachable or internal server error.' });
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 font-sans">
      <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl p-10 shadow-2xl">
        
        {/* Action Toggle */}
        <div className="flex bg-slate-800 p-1 rounded-xl mb-8">
          {(['ENCRYPT', 'DECRYPT'] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => { setAction(a); setStatus({ type: 'idle', msg: '' }); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                action === a 
                  ? (a === 'ENCRYPT' ? 'bg-violet-600 text-white shadow-lg' : 'bg-blue-600 text-white shadow-lg') 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {a}
            </button>
          ))}
        </div>

        <header className="mb-10 text-center">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            AES <span className={action === 'ENCRYPT' ? 'text-violet-400' : 'text-blue-400'}>{action}</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-2">
            HPC Distributed Encryption System
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* File Upload Area */}
          <div className={`group relative border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
            status.type === 'error' && (!file || !file.name.toLowerCase().endsWith('.bmp'))
              ? 'border-red-500 bg-red-500/5' 
              : 'border-slate-700 hover:border-violet-500/50 hover:bg-violet-500/5'
          }`}>
            <input 
              type="file" 
              accept=".bmp" 
              onChange={(e) => { 
                setFile(e.target.files?.[0] || null); 
                setStatus({ type: 'idle', msg: '' }); 
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="text-slate-300 font-medium text-sm">
              {file ? file.name : `Select .bmp image to ${action.toLowerCase()}`}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cipher Key */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex justify-between">
                <span>Cipher Key</span>
                <span className={isKeySizeValid ? 'text-emerald-500' : 'text-red-500'}>{key.length}B</span>
              </label>
              <input 
                type="text" value={key} maxLength={32}
                onChange={(e) => { setKey(e.target.value); setStatus({ type: 'idle', msg: '' }); }}
                className={`w-full bg-slate-800 border rounded-xl px-4 py-2 focus:ring-2 outline-none font-mono text-sm transition-all ${
                  !isKeySizeValid && status.type === 'error' ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-violet-500'
                }`}
              />
            </div>

            {/* IV Field */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest flex justify-between">
                <span className={isIvRequired ? 'text-slate-500' : 'text-slate-700'}>IV {!isIvRequired && '(Disabled)'}</span>
                {isIvRequired && <span className={iv.length === 16 ? 'text-emerald-500' : 'text-red-500'}>{iv.length}B</span>}
              </label>
              <input 
                type="text" value={isIvRequired ? iv : ''} disabled={!isIvRequired} maxLength={16}
                onChange={(e) => { setIv(e.target.value); setStatus({ type: 'idle', msg: '' }); }}
                className={`w-full border rounded-xl px-4 py-2 outline-none font-mono text-sm transition-all ${
                  isIvRequired 
                  ? (iv.length !== 16 && status.type === 'error' ? 'bg-slate-800 border-red-500 focus:ring-red-500' : 'bg-slate-800 border-slate-700 focus:ring-violet-500 text-slate-100') 
                  : 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                }`}
              />
            </div>
          </div>

          {/* Mode Selector */}
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Algorithm Mode</label>
            <div className="grid grid-cols-3 gap-2 w-full">
              {AES_MODES.map((m) => (
                <button
                  key={m} type="button" onClick={() => { setMode(m); setStatus({ type: 'idle', msg: '' }); }}
                  className={`py-2 rounded-lg border text-[10px] font-bold transition-all cursor-pointer text-center ${
                    mode === m 
                      ? (action === 'ENCRYPT' ? 'bg-violet-600 border-violet-500 text-white shadow-md' : 'bg-blue-600 border-blue-500 text-white shadow-md') 
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <button 
            type="submit" disabled={status.type === 'loading'}
            className={`w-full py-4 rounded-2xl font-black text-white transition-all transform hover:scale-[1.02] cursor-pointer shadow-xl ${
              action === 'ENCRYPT' ? 'bg-violet-600 hover:bg-violet-500 shadow-violet-900/20' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20'
            }`}
          >
            {status.type === 'loading' ? 'PROCESSING...' : `EXECUTE ${action}`}
          </button>
        </form>

        {status.msg && (
          <div className={`mt-8 p-4 rounded-xl text-[10px] font-mono border transition-colors ${
            status.type === 'error' ? 'bg-red-500/10 border-red-500/50 text-red-400' : 
            status.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' :
            'bg-slate-950/50 border-slate-800 text-blue-400'
          }`}>
            {'>'} {status.msg}
          </div>
        )}
      </div>
    </div>
  );
}