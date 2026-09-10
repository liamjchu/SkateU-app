import type { HomeSpotPostLayout } from '../../components/home-spot-post';

describe('HomeSpotPost layout', () => {
  it('accepts card and immersive layouts', () => {
    const layouts: HomeSpotPostLayout[] = ['card', 'immersive'];
    expect(layouts).toEqual(['card', 'immersive']);
  });
});
