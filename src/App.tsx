import { useState } from 'react';
import Sequencer from './components/Sequencer';
import { start, stop } from './audio';

function App() {
  const [playing, setPlaying] = useState(false);

  const togglePlay = () => {
    if (playing) {
      stop();
    } else {
      start();
    }
    setPlaying(!playing);
  };

  return (
    <div className="App">
      <h1>Euclidean Sequencer</h1>
      <Sequencer steps={16} hits={5} rotation={0} />
      <button onClick={togglePlay}>{playing ? 'Stop' : 'Play'}</button>
    </div>
  );
}

export default App;