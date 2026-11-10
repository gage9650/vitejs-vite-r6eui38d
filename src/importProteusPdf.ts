import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { supabase } from './supabaseClient';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export async function importProteusPdf(
  onProgress?: (current: number, total: number) => void
) {
  // 로그인 확인
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) throw userError;

  if (!userData.user) {
    throw new Error('먼저 Supabase 로그인이 필요합니다.');
  }

  // Storage에서 PDF 다운로드
  const { data: file, error: downloadError } = await supabase.storage
    .from('proteus-documents')
    .download('proteus-pcb-guide.pdf.pdf');

  if (downloadError) throw downloadError;

  // PDF 열기
  const pdf = await pdfjsLib.getDocument({
    data: await file.arrayBuffer(),
  }).promise;

  const rows = [];

  // 페이지별 텍스트 추출
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();

    const content = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');

    rows.push({
      file_name: 'proteus-pcb-guide.pdf.pdf',
      page_number: pageNumber,
      content,
    });

    onProgress?.(pageNumber, pdf.numPages);
  }

  // 25페이지씩 데이터베이스에 저장
  for (let i = 0; i < rows.length; i += 25) {
    const batch = rows.slice(i, i + 25);

    const { error: insertError } = await supabase
      .from('proteus_pages')
      .insert(batch);

    if (insertError) throw insertError;
  }

  return {
    totalPages: pdf.numPages,
    savedPages: rows.length,
  };
}
