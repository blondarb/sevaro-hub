// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import portfolioData from '@/data/portfolio.json';
import { PortfolioBoard } from '@/components/portfolio/PortfolioBoard';
import type { PortfolioData } from '@/lib/portfolio';

const data = portfolioData as PortfolioData;

describe('PortfolioBoard', () => {
  it('distinguishes portfolio projects from their linked features', () => {
    render(<PortfolioBoard data={data} />);

    expect(screen.getByRole('heading', { name: 'Portfolio projects' })).toBeInTheDocument();
    const sdneProject = screen.getByRole('button', { name: /SDNE measurement validity and XR data quality/i });
    expect(sdneProject).toBeInTheDocument();
    expect(within(sdneProject).getByText('2 linked features')).toBeInTheDocument();

    fireEvent.click(sdneProject);
    const detail = screen.getByTestId('project-detail');
    expect(within(detail).getByRole('heading', { name: 'Features / initiatives' })).toBeInTheDocument();
    expect(within(detail).getByText('Measurement validity evidence')).toBeInTheDocument();
    expect(within(detail).getByText('Samsung XR data-quality characterization')).toBeInTheDocument();
  });

  it('filters by text and stage', () => {
    render(<PortfolioBoard data={data} />);

    fireEvent.change(screen.getByLabelText('Search portfolio'), { target: { value: 'Stroke Demand' } });
    expect(screen.getByText('Stroke Demand Forecasting')).toBeInTheDocument();
    expect(screen.queryByText('Clinical Compass')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search portfolio'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Stage'), { target: { value: 'Active' } });
    expect(screen.getByText('Sevaro Hub portfolio operating system')).toBeInTheDocument();
    expect(screen.queryByText('Stroke Demand Forecasting')).not.toBeInTheDocument();
  });

  it('provides a Now / Next / Later view', () => {
    render(<PortfolioBoard data={data} />);

    fireEvent.click(screen.getByRole('button', { name: 'Later' }));

    expect(screen.getByText('Clinical Compass')).toBeInTheDocument();
    expect(screen.getByText('NeuroColleague')).toBeInTheDocument();
    expect(screen.queryByText('Sevaro Hub portfolio operating system')).not.toBeInTheDocument();
  });

  it('shows missing ownership, verification, blockers, intake, and decision history', () => {
    render(<PortfolioBoard data={data} />);

    expect(screen.getAllByText('Missing owner').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Needs verification').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /SDNE measurement validity and XR data quality/i }));
    const detail = screen.getByTestId('project-detail');
    expect(within(detail).getByText('Untriaged idea')).toBeInTheDocument();
    expect(within(detail).getByRole('heading', { name: 'Decision history' })).toBeInTheDocument();
  });

  it('opens a linked project from an improvement-queue deep link', () => {
    render(<PortfolioBoard data={data} initialProjectId="project-ai-historian" />);

    expect(screen.getByTestId('project-detail')).toHaveAccessibleName('AI Historian detail');
    expect(within(screen.getByTestId('project-detail')).getByText('Virtual on-video neurologic historian')).toBeInTheDocument();
  });
});
