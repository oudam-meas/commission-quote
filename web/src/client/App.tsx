import { QuoteDisplay } from './QuoteDisplay';
import { QuoteForm } from './QuoteForm';
import { useQuote } from './useQuote';

type RequestStatusProps = {
  isLoading: boolean;
  message: string | null;
};

// isLoading and message never both hold at once: useQuote clears message
// before a request starts and only sets it after isLoading goes false.
function RequestStatus({ isLoading, message }: RequestStatusProps) {
  if (isLoading) {
    return <p role="status">Getting your quote…</p>;
  }

  if (message) {
    return (
      <div role="alert">
        <p>{message}</p>
      </div>
    );
  }

  return null;
}

export function App() {
  const { quote, message, isLoading, requestQuote } = useQuote();

  return (
    <main>
      <h1>Commission Quote App</h1>
      <QuoteForm onSubmit={requestQuote} disabled={isLoading} />

      <RequestStatus isLoading={isLoading} message={message} />
      <QuoteDisplay quote={quote} />
    </main>
  );
}
