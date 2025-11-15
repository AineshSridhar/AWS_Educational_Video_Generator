import React, {useState, useEffect, useCallback} from 'react';
import axios from 'axios'

const API_BASE_URL = 'http://localhost:8000/api';

function App() {
  const [script, setScript] = useState("");
  const [style, setStyle] = useState('3D diagram');
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<any | null>(null)

  const submitJob = async() => {
    try {
      const response = await axios.post(`${API_BASE_URL}/generate`, {script, style});
      setJobId(response.data.job_id);
      setJobStatus(response.data);
    } catch (error){
      console.error("Error submitting job: ", error)
    }
  };
  
  const checkStatus = useCallback(async() => {
    if(!jobId) return;
    try{
      const response = await axios.get(`${API_BASE_URL}/status/${jobId}`);
      setJobStatus(response.data);
    } catch (error) {
      console.error("Error checking status:", error);
      setJobId(null);
    }
  }, [jobId]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (jobId && jobStatus?.status !== 'COMPLETED'){
      interval = setInterval(checkStatus, 3000);
    } else if(interval){
      clearInterval(interval);
    }
    return () => { if (interval) clearInterval(interval);};
  }, [jobId, jobStatus?.status, checkStatus]);

  return (
    <div style = {{ padding: "20px", maxWidth: '800px', margin: 'auto'}}>
      <h2>AI Educational Video Creator</h2>

      {!jobId && (
        <div>
          <textarea
            value = {script}
            onChange = {(e) => setScript(e.target.value)}
            placeholder = "Enter your educational script (e.g. The Krebs Cycle is a series of chemical reactions...)"
            rows = {5}
            style = {{width: '100%', marginBottom: '10px'}}
          />
          <select value = {style} onChange={(e) => setStyle(e.target.value)}>
            <option value = "3D Diagram">3D Diagram</option>
            <option value = "2D Cartoon">3D Diagram</option>
          </select>
          <button onClick={submitJob} style = {{display: 'block', marginTop: '10px'}}>
            Generate Video
          </button>
        </div>
      )}

      {jobId && (
        <div style = {{marginTop: '20px', border: '1px solid #ccc', padding: '15px'}}>
          <h3>Generation Job Status: {jobStatus?.status}</h3>
          <p>Job ID: {jobId}</p>
          {jobStatus?.progress && <p>Progress: {jobStatus.progress}</p>}
          {jobStatus?.status === "COMPLETED" ? (
            <p>
              Video Ready! <a href = {jobStatus.video_url} target = "_blank">Download Video</a>
            </p>
          ) : (
            <p>Please wait... The AI is working hard!</p>
          )}
        </div>
      )}
    </div>
  )
}

export default App
