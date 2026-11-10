import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { importProteusPdf } from './importProteusPdf';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState<any>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState('');

  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  async function signUp() {
    setBusy(true);
    setMessage('');

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    setBusy(false);

    if (error) {
      setMessage(error.message);
    } else if (!data.session) {
      setMessage('회원가입 완료! 이메일 인증 후 로그인해 줘긔!');
    } else {
      setMessage('회원가입 성공긔!');
    }
  }

  async function signIn() {
    setBusy(true);
    setMessage('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setBusy(false);
    setMessage(error ? error.message : '로그인 성공긔!');
  }

  async function signOut() {
    await supabase.auth.signOut();
    setMessages([]);
    setMessage('로그아웃했긔!');
  }

  async function handleImport() {
    setBusy(true);
    setProgress(0);
    setTotal(0);
    setMessage('PDF를 읽는 중이긔...');

    try {
      const result = await importProteusPdf((current, count) => {
        setProgress(current);
        setTotal(count);
      });

      setMessage(`완료긔! 총 ${result.savedPages}페이지 저장했긔!`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'PDF 처리 중 오류가 발생했긔.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleAsk() {
    if (!question.trim() || busy) return;

    const userQuestion = question.trim();

    setMessages((prev) => [...prev, { role: 'user', content: userQuestion }]);

    setQuestion('');
    setBusy(true);
    setMessage('');

    try {
      const { data, error } = await supabase.functions.invoke('proteus-ai', {
        body: {
          question: userQuestion,
        },
      });

      if (error) {
        throw new Error(data?.error || error.message || 'AI 연결에 실패했긔.');
      }

      if (!data?.answer) {
        throw new Error(data?.error || 'AI 답변이 비어 있긔.');
      }

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.answer },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            error instanceof Error
              ? `오류가 발생했긔: ${error.message}`
              : '알 수 없는 오류가 발생했긔.',
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 750,
        margin: '40px auto',
        padding: 20,
        fontFamily: 'sans-serif',
      }}
    >
      <h1>Proteus AI Agent 🤖</h1>

      <p>Proteus PCB 설계를 도와주는 AI 도우미긔!</p>

      {!user ? (
        <section>
          <h2>로그인 / 회원가입</h2>

          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              display: 'block',
              width: '100%',
              padding: 12,
              marginBottom: 12,
              boxSizing: 'border-box',
            }}
          />

          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              display: 'block',
              width: '100%',
              padding: 12,
              marginBottom: 12,
              boxSizing: 'border-box',
            }}
          />

          <button disabled={busy} onClick={signUp}>
            회원가입
          </button>

          <button disabled={busy} onClick={signIn} style={{ marginLeft: 8 }}>
            로그인
          </button>
        </section>
      ) : (
        <>
          <section>
            <p>로그인 계정: {user.email}</p>

            <button onClick={signOut} disabled={busy}>
              로그아웃
            </button>
          </section>

          <hr style={{ margin: '24px 0' }} />

          <section>
            <h2>Proteus AI 채팅</h2>

            <div
              style={{
                minHeight: 250,
                maxHeight: 450,
                overflowY: 'auto',
                border: '1px solid #ccc',
                borderRadius: 10,
                padding: 14,
                marginBottom: 14,
              }}
            >
              {messages.length === 0 && (
                <p style={{ color: '#888' }}>
                  궁금한 Proteus 질문을 입력해 보긔!
                </p>
              )}

              {messages.map((msg, index) => (
                <div
                  key={index}
                  style={{
                    marginBottom: 18,
                    textAlign: msg.role === 'user' ? 'right' : 'left',
                  }}
                >
                  <strong>{msg.role === 'user' ? '나' : 'Proteus AI'}</strong>

                  <div
                    style={{
                      display: 'inline-block',
                      maxWidth: '90%',
                      padding: 12,
                      marginTop: 5,
                      borderRadius: 10,
                      background: msg.role === 'user' ? '#dbeafe' : '#eee',
                      whiteSpace: 'pre-wrap',
                      overflowWrap: 'anywhere',
                      textAlign: 'left',
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {busy && (
                <p style={{ color: '#777' }}>AI가 답변을 생각하고 있긔...</p>
              )}
            </div>

            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Proteus에 관해 궁금한 점을 입력해 줘긔!"
              rows={3}
              disabled={busy}
              style={{
                width: '100%',
                padding: 12,
                boxSizing: 'border-box',
                resize: 'vertical',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAsk();
                }
              }}
            />

            <button
              onClick={handleAsk}
              disabled={busy || !question.trim()}
              style={{ marginTop: 10, padding: '10px 20px' }}
            >
              {busy ? '답변 생성 중...' : '질문 보내기'}
            </button>
          </section>

          <hr style={{ margin: '28px 0' }} />

          <section>
            <h2>PDF 자료 관리</h2>

            <p>proteus-pcb-guide.pdf.pdf</p>

            <button onClick={handleImport} disabled={busy}>
              PDF 가져오기
            </button>

            {total > 0 && (
              <p>
                진행 상황: {progress} / {total} 페이지
              </p>
            )}
          </section>
        </>
      )}

      {message && (
        <p style={{ marginTop: 20, whiteSpace: 'pre-wrap' }}>{message}</p>
      )}
    </main>
  );
}

export default App;
