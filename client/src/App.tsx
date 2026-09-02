import { StealthHUD } from './components/overlay/StealthHUD';

export function App() {
  return (
    <main className="w-screen h-screen overflow-hidden bg-transparent relative flex flex-col font-sans">
      <div className="w-full h-full p-2 animate-fadeIn">
        <StealthHUD />
      </div>
    </main>
  );
}

export default App;

