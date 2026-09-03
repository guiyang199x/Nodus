import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  it('never relies on illustration alone', () => {
    render(
      <EmptyState
        imageSrc="/illustrations/first-upload.png"
        imageAlt="人物把第一份资料放入档案盒"
        title="放入第一份资料"
        description="上传后可以离开，系统会继续处理。"
        action={<button>上传资料</button>}
      />
    );
    expect(screen.getByRole('img', { name: '人物把第一份资料放入档案盒' })).toBeVisible();
    expect(screen.getByRole('heading', { name: '放入第一份资料' })).toBeVisible();
    expect(screen.getByRole('button', { name: '上传资料' })).toBeVisible();
  });
});
