import { site } from '@/config/site';

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline">
      <div className="mx-auto flex max-w-[75rem] flex-wrap gap-x-3 px-4 py-6 text-caption text-muted sm:px-6">
        <span>
          © <bdi className="num">{new Date().getFullYear()}</bdi>{' '}
          <span lang="en" dir="ltr">
            {site.name}
          </span>
        </span>
        <span>{site.descriptor}</span>
      </div>
    </footer>
  );
}
