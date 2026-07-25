import 'package:flutter/material.dart';

import 'stitch_routes.dart';
import 'stitch_theme.dart';

class StitchShopProductDetailScreen extends StatefulWidget {
  const StitchShopProductDetailScreen({super.key});

  @override
  State<StitchShopProductDetailScreen> createState() =>
      _StitchShopProductDetailScreenState();
}

class _StitchShopProductDetailScreenState
    extends State<StitchShopProductDetailScreen> {
  int quantity = 1;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF2EBD9),
      body: CustomScrollView(
        slivers: <Widget>[
          SliverToBoxAdapter(
            child: SafeArea(
              child: Container(
                height: 64,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                child: Row(
                  children: <Widget>[
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.arrow_back),
                    ),
                    Expanded(
                      child: Text(
                        'SHOP',
                        textAlign: TextAlign.center,
                        style: StitchTheme.headline(
                          size: 22,
                          color: StitchTheme.darkText,
                          letterSpacing: 2.4,
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: () {
                        Navigator.pushNamed(context, StitchRoutes.shopEmptyBag);
                      },
                      icon: const Icon(Icons.shopping_bag_outlined),
                    ),
                  ],
                ),
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: SizedBox(
              height: 470,
              child: Image.network(
                'https://lh3.googleusercontent.com/aida-public/AB6AXuBZ4qP3djcHAHQnHdjE6NgWzf_osRBEchL34xb6skJoFXIQGEBavVQ5CU6S1Iqyp9WGWL1QFVuvRmaJJY__tys1djB8nimqM9cIr22MX0ZXdc1yZAED9BFNIdMNLY5sHTxDUV9ingRDcvdmt7iMIGfTZZwZWX5vopaBO8b8f1UZYn9_95HpV4D8GnVGaXepH_0dt-0FAe35SfLW2M2x6ye-s7Z8HRg_wJT55uja_e-5f4hum-O7AR7ZeesvUYoufKYRhJIeF229ClQK',
                fit: BoxFit.cover,
                width: double.infinity,
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 22, 24, 120),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    'MINIATURE APOLLO BUST',
                    style: StitchTheme.headline(
                      size: 30,
                      color: StitchTheme.darkText,
                      letterSpacing: 1,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '\$85.00',
                    style: StitchTheme.body(
                      size: 24,
                      weight: FontWeight.w700,
                      color: StitchTheme.adwaGold,
                    ),
                  ),
                  const SizedBox(height: 18),
                  Text(
                    'Bring a touch of classical antiquity into your modern space with this exquisite miniature replica of the Apollo Belvedere. Expertly cast from a premium marble resin blend and mounted on polished marble.',
                    style: StitchTheme.body(
                      size: 16,
                      color: StitchTheme.slate.withValues(alpha: 0.84),
                      height: 1.6,
                    ),
                  ),
                  const SizedBox(height: 24),
                  Row(
                    children: <Widget>[
                      Container(
                        decoration: BoxDecoration(
                          border: Border.all(
                            color: StitchTheme.darkText.withValues(alpha: 0.3),
                          ),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Row(
                          children: <Widget>[
                            IconButton(
                              onPressed: quantity > 1
                                  ? () => setState(() => quantity--)
                                  : null,
                              icon: const Icon(Icons.remove),
                            ),
                            SizedBox(
                              width: 32,
                              child: Text(
                                '$quantity',
                                textAlign: TextAlign.center,
                                style: StitchTheme.body(
                                  size: 20,
                                  weight: FontWeight.w700,
                                  color: StitchTheme.darkText,
                                ),
                              ),
                            ),
                            IconButton(
                              onPressed: quantity < 10
                                  ? () => setState(() => quantity++)
                                  : null,
                              icon: const Icon(Icons.add),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Added to your bag.'),
                              ),
                            );
                          },
                          style: FilledButton.styleFrom(
                            backgroundColor: StitchTheme.adwaGold,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 15),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(999),
                            ),
                          ),
                          icon: const Icon(Icons.shopping_cart_outlined),
                          label: Text(
                            'ADD TO BAG',
                            style: StitchTheme.overline(
                              size: 11,
                              color: Colors.white,
                              letterSpacing: 1.4,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 28),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: <Widget>[
                      Text(
                        'Related Items',
                        style: StitchTheme.headline(
                          size: 24,
                          color: StitchTheme.darkText,
                        ),
                      ),
                      Text(
                        'VIEW ALL',
                        style: StitchTheme.overline(
                          size: 10,
                          color: StitchTheme.adwaGold,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    height: 250,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      children: const <Widget>[
                        _RelatedCard(
                          title: 'Bronze Gladiator Figurine',
                          price: '\$120.00',
                          image:
                              'https://lh3.googleusercontent.com/aida-public/AB6AXuA-F-yaODBpL0s6XvJUZkzU3o9JNxMhR67VTbEmeW3kmmO3n95YizuEHsn-uL1SvvOoA6VW60ZFXxLkKmawFIC2C_FY_2_oLr1y6TW0mFG_tfjm7XgYhnomg8GnovJHxF9JaIzjmBJ4VY0aNYA_zqg6gVXV7piulbm5I79J6oJpNBBcEStvdiL6k_TOQ66-vWJTR6Lt65otOvqylu1no2kcgeO3ppjXKHPZKDjLPPAcspp9vilNhbQEfUXS2cnxUx_m4QzakIedjzRf',
                        ),
                        _RelatedCard(
                          title: 'Renaissance Masters Vol II',
                          price: '\$45.00',
                          image:
                              'https://lh3.googleusercontent.com/aida-public/AB6AXuD_rgbgWRn19uIQC2gHrOwAgTicifF3t1Kkd40A1oDSpcyTQY_39VD992SFF_lrI-2KppZGYf7uCMpKvyYr6B71b_Kz37DmxHHb7ibwFk_IhwUN6mZuKZKvOB33a-Wf_pVhZNlR8mBgiFe0zdYIItJojp9mpc5-e9P5qUUhvzbWZqyQS691pWkWqWhiLXaHV08IXN0-i81j7T5i-6tx2llnJ1mdq5tu9d_AshdY5C2nAJw7nFIWmutnJn2cY9JOyABmXgClbbfWA2ia',
                        ),
                        _RelatedCard(
                          title: 'Geometric Brass Bookends',
                          price: '\$65.00',
                          image:
                              'https://lh3.googleusercontent.com/aida-public/AB6AXuB-8J6lPOectdBw80qdgBRV-eHbH2a-YLbA6UM9f2hEqVGqQvBdPmFSWrPNCKTmBt0rl04fwXatQHyUC33of3YiaGLpMek14RocuAqC80mBGKkpXzC3dT_llyZ0oOAFtDEZBrMlZUcZiT25Z8jSrjkiACZ7jvAtc4K1XzLI8hDvMs7EUNTy1R5pHnjBpWO7xqb07SeFaTMts-MxLQAhTUOGgOkGb92F8P5bcPOiEZ8jcz7_Dgdo2ace8bwrIGuWAhXSGGT4R5rQFu2J',
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _RelatedCard extends StatelessWidget {
  const _RelatedCard({
    required this.title,
    required this.price,
    required this.image,
  });

  final String title;
  final String price;
  final String image;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 190,
      margin: const EdgeInsets.only(right: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.network(image, fit: BoxFit.cover, width: double.infinity),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: StitchTheme.headline(size: 16, color: StitchTheme.darkText),
          ),
          Text(
            price,
            style: StitchTheme.body(
              size: 14,
              color: StitchTheme.slate.withValues(alpha: 0.8),
            ),
          ),
        ],
      ),
    );
  }
}
